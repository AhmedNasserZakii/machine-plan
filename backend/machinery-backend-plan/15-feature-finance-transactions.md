# 15 — Feature: Finance Transactions (expenses & income)

## Goal

Record every pound the company spends and receives, categorised, dated, attributable to a branch,
filterable by any date range, with an optional invoice photo.

## Required vs optional (exactly as specified by the business)

| Field | Required |
|---|---|
| amount | ✅ |
| category | ✅ |
| transaction date | ✅ |
| payment method | ✅ |
| supplier | ❌ |
| invoice photo | ❌ |
| notes | ❌ |
| branch | ❌ (null = company-level) |

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/finance/transactions` | `finance.read` |
| GET | `/finance/transactions/:id` | `finance.read` |
| POST | `/finance/transactions` | `finance.create` |
| PATCH | `/finance/transactions/:id` | `finance.update` |
| POST | `/finance/transactions/:id/void` | `finance.void` |
| GET | `/finance/summary` | `finance.read` |
| GET | `/finance/by-category` | `finance.read` |
| GET | `/finance/export` | `reports.export` |
| GET | `/payment-methods` | `finance.read` |
| GET/POST | `/suppliers` | `finance.read` / `finance.create` |

### Filters on `GET /finance/transactions`

`kind` (`EXPENSE`/`INCOME`/omit for both), `categoryId` (+ `includeSubcategories=true` by default),
`branchId`, `paymentMethodId`, `supplierId`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`,
`source`, `search` (notes + reference no), `hasInvoice`, pagination, `sortBy` (date/amount).

## DTOs

```ts
export class CreateFinanceTransactionDto {
  @IsEnum(FinanceKind) kind: 'EXPENSE'|'INCOME';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsUUID() categoryId: string;
  @IsDateString() transactionDate: string;
  @IsUUID() paymentMethodId: string;

  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() invoiceMediaId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @IsOptional() @IsUUID() clientUuid?: string;    // offline idempotency
}

export class VoidFinanceTransactionDto {
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}
```

## Business rules

1. **`kind` must match the category's `kind`** → `422 CATEGORY_KIND_MISMATCH`.
2. `transactionDate` cannot be in the future → `422 FUTURE_DATE_NOT_ALLOWED`.
3. `transactionDate` cannot be older than `FINANCE_BACKDATE_LIMIT_DAYS` (default 90) unless the
   caller has `finance.update` — stops accidental year-typos while allowing legitimate catch-up.
4. **Transactions are never deleted, only voided.** Voiding sets `is_voided = true` and records who,
   when and why. Voided rows are excluded from every aggregate but remain visible with a filter.
5. **Auto-generated transactions cannot be edited or voided directly.** A row with
   `source ≠ MANUAL` is owned by its origin record. To reverse it, reverse the maintenance order or
   the violation. Return `422 AUTO_TRANSACTION_IMMUTABLE`.
6. Editing a manual transaction is allowed for `finance.update` holders within
   `FINANCE_EDIT_WINDOW_DAYS` (default 30); after that only voiding is possible. Every edit is
   audited with a before/after diff.
7. Currency is EGP only — no currency column, no conversion. If this ever changes it is a
   migration, not a config flag.
8. Branch scoping: a user without `finance.read.all` sees only his branch's transactions plus
   company-level rows (`branch_id IS NULL`) if he has `finance.read`.
9. After every write, enqueue a **budget check** job for the affected category path and period
   (`16`).

## `GET /finance/summary`

The dashboard number block.

Params: `dateFrom`, `dateTo`, `branchId`, `compareToPrevious=true`.

```json
{
  "period": { "from":"2026-08-01", "to":"2026-08-31" },
  "income":  { "total": 152300.00, "count": 84 },
  "expense": { "total":  93450.00, "count": 211 },
  "net": 58850.00,
  "comparison": {
    "period": { "from":"2026-07-01", "to":"2026-07-31" },
    "incomeChangePercent": 12.4,
    "expenseChangePercent": -3.1,
    "netChangePercent": 41.9
  },
  "byPaymentMethod": [
    { "id":"…", "name":"كاش", "expense": 41200.00, "income": 88300.00 }
  ],
  "topExpenseCategories": [
    { "id":"…", "name":"صيانة", "total": 28400.00, "percentOfExpense": 30.4 }
  ]
}
```

## `GET /finance/by-category`

The core "where did every category's money go" report — the exact business ask.

Params: `dateFrom`, `dateTo`, `kind`, `branchId`, `rootCategoryId`, `maxDepth`.

```json
{
  "period": { "from":"2026-06-01", "to":"2026-08-31" },
  "grandTotal": 93450.00,
  "categories": [
    { "id":"…", "name":"مصاريف تشغيل", "depth": 0,
      "directTotal": 0, "rolledUpTotal": 61200.00,
      "percentOfGrandTotal": 65.5, "transactionCount": 0,
      "budget": { "amount": 70000.00, "usedPercent": 87.4, "status":"WARNING" },
      "children": [
        { "id":"…", "name":"صيانة", "depth": 1,
          "directTotal": 4200.00, "rolledUpTotal": 28400.00,
          "percentOfParent": 46.4, "transactionCount": 6,
          "children": [
            { "id":"…", "name":"قطع غيار", "depth": 2,
              "directTotal": 24200.00, "rolledUpTotal": 24200.00,
              "transactionCount": 31, "children": [] }
          ] }
      ] }
  ]
}
```

Implementation: **one** query that joins transactions to categories and groups by
`category_id`, then assemble the tree in memory from the flat rows plus the category tree.
Do not issue one query per category.

## Performance

```sql
CREATE INDEX idx_ft_date            ON finance_transactions (transaction_date) WHERE is_voided = false;
CREATE INDEX idx_ft_cat_date        ON finance_transactions (category_id, transaction_date) WHERE is_voided = false;
CREATE INDEX idx_ft_branch_date     ON finance_transactions (branch_id, transaction_date) WHERE is_voided = false;
CREATE INDEX idx_ft_kind_date       ON finance_transactions (kind, transaction_date) WHERE is_voided = false;
CREATE UNIQUE INDEX uq_ft_source_ref ON finance_transactions (source_ref_type, source_ref_id)
  WHERE source <> 'MANUAL';
```

The last one is the guard that makes auto-posting from maintenance and violations idempotent.

## Export

`GET /finance/export?format=xlsx|csv` with the same filter set. Generated by a BullMQ job for large
ranges, returning a signed download URL. Columns: reference no, date, kind, category path, amount,
payment method, supplier, branch, notes, source, created by.

## Tests

- expense under an income category → 422
- future date → 422
- voiding excludes the row from `/finance/summary`
- editing an `AUTO_MAINTENANCE` transaction → 422
- `by-category` rollup on a 3-level tree matches the sum of leaves
- branch-scoped user cannot see another branch's transactions

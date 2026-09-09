# 16 — Feature: Budgets & Alerts

## Goal

Optionally set a spending limit per category (and optionally per branch) for a period, and get
warned as the spend approaches or crosses it. Budgets are **optional** — the system works perfectly
without a single one.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/finance/budgets` | `finance.read` |
| GET | `/finance/budgets/:id` | `finance.read` |
| POST | `/finance/budgets` | `finance.budgets.manage` |
| PATCH | `/finance/budgets/:id` | `finance.budgets.manage` |
| DELETE | `/finance/budgets/:id` | `finance.budgets.manage` |
| GET | `/finance/budgets/status` | `finance.read` |

## DTO

```ts
export class CreateBudgetDto {
  @IsUUID() categoryId: string;
  @IsOptional() @IsUUID() branchId?: string;         // null = company-wide
  @IsEnum(BudgetPeriod) periodType: 'MONTHLY'|'QUARTERLY'|'YEARLY'|'CUSTOM';
  @IsDateString() periodStart: string;
  @IsDateString() periodEnd: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) alertThresholdPercent?: number = 80;
  @IsOptional() @IsBoolean() includeSubcategories?: boolean = true;
  @IsOptional() @IsBoolean() autoRenew?: boolean = false;
}
```

## Business rules

1. Budgets apply to `EXPENSE` categories only → `422 BUDGET_ON_INCOME_CATEGORY`.
2. `includeSubcategories = true` (the default) means the budget is measured against the **rolled-up**
   total using the LTREE descendant query from `14`.
3. Overlapping budgets for the same (category, branch, period) are rejected →
   `409 OVERLAPPING_BUDGET`. Check with a range overlap condition:
   ```sql
   WHERE category_id = :cat AND branch_id IS NOT DISTINCT FROM :branch
     AND daterange(period_start, period_end, '[]') && daterange(:start, :end, '[]')
   ```
4. A parent-category budget and a child-category budget may coexist — that is deliberate and useful.
   Both are evaluated independently.
5. `autoRenew` on a `MONTHLY` budget creates next month's budget automatically on the 1st via a
   scheduled job, copying the amount.
6. Deleting a budget never touches transactions.

## Status computation

```
usedPercent = rolledUpSpend / budget.amount * 100

status:
  OK        usedPercent <  alertThresholdPercent
  WARNING   alertThresholdPercent ≤ usedPercent < 100
  EXCEEDED  usedPercent ≥ 100
```

## `GET /finance/budgets/status`

```json
{
  "asOf": "2026-09-07",
  "budgets": [
    { "id":"…",
      "category": { "id":"…", "name":"صيانة", "path":"مصاريف تشغيل / صيانة" },
      "branch": null,
      "period": { "type":"MONTHLY", "start":"2026-09-01", "end":"2026-09-30",
                  "daysElapsed": 7, "daysTotal": 30, "elapsedPercent": 23.3 },
      "amount": 30000.00, "spent": 27400.00, "remaining": 2600.00,
      "usedPercent": 91.3, "status":"WARNING",
      "pace": { "expectedSpendByNow": 6990.00, "overPaceBy": 20410.00, "projectedTotal": 117428.00 }
    }
  ],
  "summary": { "total": 6, "ok": 3, "warning": 2, "exceeded": 1 }
}
```

> The `pace` block is what makes a budget actionable. "91% used on day 7 of 30" is a much louder
> signal than "91% used".

## Alert engine

**Trigger:** a BullMQ job enqueued after every finance transaction write, plus a nightly sweep at
02:00 that catches budgets crossed by date passage alone.

**Job logic:**
1. Find all active budgets whose period contains the transaction date and whose category path is an
   ancestor-or-self of the transaction's category (respecting `includeSubcategories`).
2. Recompute `usedPercent`.
3. Compare to the last recorded alert level stored on the budget
   (`last_alert_level VARCHAR(10) NULL`).
4. Fire a notification **only on level escalation** (`OK → WARNING`, `WARNING → EXCEEDED`).
   This is the whole point: without it, every transaction after 80% spams the Director.
5. Persist the new level.

**Recipients:** all users with `finance.read` scoped to the budget's branch, plus every `DIRECTOR`.

**Notification templates** (localized, per `02`):
- `BUDGET_WARNING` — "قسم {category} وصل {percent}% من الميزانية ({spent} من {amount})"
- `BUDGET_EXCEEDED` — "قسم {category} تعدى الميزانية بمقدار {overBy}"

## Reset on period rollover

A budget's alert level resets when a new period begins. With `autoRenew`, the new budget row starts
at `last_alert_level = NULL`.

## Tests

- budget on an income category → 422
- overlapping budgets → 409
- crossing 80% fires exactly one WARNING, further transactions below 100% fire nothing
- crossing 100% fires exactly one EXCEEDED
- `includeSubcategories = false` ignores child-category spend
- voiding a transaction can move status back down without firing a notification

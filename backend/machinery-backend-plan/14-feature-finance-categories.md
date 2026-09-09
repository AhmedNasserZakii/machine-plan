# 14 — Feature: Finance Categories (unlimited nesting)

## Goal

Expenses and income are organised into a tree of categories with **no depth limit** — subcategories
of subcategories of subcategories. Reports roll up automatically.

## Storage: materialized path

Two viable options. Pick one and stay with it.

**Option A — LTREE (recommended for PostgreSQL)**
```sql
CREATE EXTENSION IF NOT EXISTS ltree;
ALTER TABLE finance_categories ADD COLUMN path LTREE NOT NULL;
CREATE INDEX idx_fc_path_gist ON finance_categories USING GIST (path);
```
Descendants of a node: `WHERE path <@ :parentPath`. Fast, indexed, no recursion.

**Option B — VARCHAR materialized path** (`/uuid/uuid/uuid/`) with `LIKE :path || '%'`.
Portable, slightly slower, no extension needed.

Both keep `parent_id` for direct-children queries and referential integrity. `depth` is derived and
stored for cheap sorting.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/finance/categories` | `finance.read` |
| GET | `/finance/categories/tree` | `finance.read` |
| GET | `/finance/categories/:id` | `finance.read` |
| POST | `/finance/categories` | `finance.categories.manage` |
| PATCH | `/finance/categories/:id` | `finance.categories.manage` |
| PATCH | `/finance/categories/:id/move` | `finance.categories.manage` |
| DELETE | `/finance/categories/:id` | `finance.categories.manage` |
| GET | `/finance/categories/:id/breadcrumb` | `finance.read` |

`GET /finance/categories/tree?kind=EXPENSE&includeInactive=false` returns the whole nested tree in
one call, already localized. With realistic category counts (dozens, not thousands) this is far
cheaper than lazy-loading each level.

## DTOs

```ts
export class CreateFinanceCategoryDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsEnum(FinanceKind) kind: 'EXPENSE'|'INCOME';
  @ValidateNested() @Type(() => TranslationsDto) @HasDefaultLocale()
  translations: Record<Locale, { name: string; description?: string }>;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class MoveFinanceCategoryDto {
  @IsOptional() @IsUUID() newParentId?: string;   // null = move to root
}
```

## Tree response shape

```json
{
  "data": [
    { "id":"…", "name":"مصاريف تشغيل", "kind":"EXPENSE", "depth": 0,
      "isSystem": false, "transactionCount": 0, "totalAmount": 0,
      "children": [
        { "id":"…", "name":"صيانة", "code":"MAINTENANCE", "depth": 1, "isSystem": true,
          "children": [
            { "id":"…", "name":"قطع غيار", "depth": 2, "children": [] },
            { "id":"…", "name":"أجور فنيين", "depth": 2, "children": [] }
          ] }
      ] }
  ]
}
```

## Business rules

1. **`kind` is inherited and immutable.** A child of an `EXPENSE` category is always `EXPENSE`.
   Reject a mismatch with `422 CATEGORY_KIND_MISMATCH`. You cannot change a category's kind after
   creation — create a new one instead.
2. **System categories cannot be deleted or have their `code` changed.** Seeded:
   | code | kind | used by |
   |---|---|---|
   | `MAINTENANCE` | EXPENSE | maintenance auto-posting (`11`) |
   | `MACHINE_PURCHASE` | EXPENSE | factory intake |
   | `VIOLATION_CHARGES` | INCOME | violation charging (`10`) |
   | `MERCHANT_SUBSCRIPTIONS` | INCOME | subscription collection (`08`) |
   Their names are editable per locale; their identity is not.
3. **Deleting a category with transactions is forbidden** → `409 CATEGORY_HAS_TRANSACTIONS`, with
   the count. Offer deactivation instead (`is_active = false` hides it from pickers but keeps
   history and reports intact).
4. **Deleting a category with children is forbidden** → `409 CATEGORY_HAS_CHILDREN`.
5. **Moving a category rewrites the paths of the entire subtree** inside one transaction:
   ```sql
   UPDATE finance_categories
      SET path = :newParentPath || subpath(path, nlevel(:oldPath) - 1),
          depth = nlevel(:newParentPath) + nlevel(path) - nlevel(:oldPath)
    WHERE path <@ :oldPath;
   ```
6. **Cycle prevention:** a category cannot be moved under its own descendant →
   `422 CIRCULAR_CATEGORY_REFERENCE`. Check `newParent.path <@ category.path`.
7. Category names are localized per `02`; the default locale (`ar`) is required.
8. A **transaction may only be attached to a leaf or any node** — both are allowed. Roll-ups handle
   it. Do not force leaf-only; that fights how people actually book expenses.

## Rollup semantics (used everywhere in reports)

- "Direct total" = transactions whose `category_id` is exactly this node.
- "Rolled-up total" = transactions whose category path is a descendant of (or equal to) this node.

```sql
SELECT COALESCE(SUM(ft.amount), 0)
  FROM finance_transactions ft
  JOIN finance_categories fc ON fc.id = ft.category_id
 WHERE fc.path <@ :categoryPath
   AND ft.is_voided = false
   AND ft.transaction_date BETWEEN :from AND :to;
```

Every report must expose **both** numbers. A parent showing only its own direct spend confuses
people; showing only the rollup hides where the money actually went.

## Tests

- creating an INCOME child under an EXPENSE parent → 422
- deleting a system category → 403
- deleting a category with transactions → 409
- moving a subtree updates every descendant path and depth
- moving a node under its own child → 422
- rollup total on a grandparent includes grandchildren transactions

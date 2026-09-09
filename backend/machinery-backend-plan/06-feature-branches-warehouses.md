# 06 — Feature: Branches & Warehouses

## Goal

Machines belong to a branch. A branch has one or more supervisors and its own warehouse. Movement
between branches is **not** direct — a machine must travel back to the company warehouse first and
then be issued to the new branch as a fresh outbound transfer.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/branches` | any authenticated |
| GET | `/branches/:id` | any authenticated |
| POST | `/branches` | `branches.manage` |
| PATCH | `/branches/:id` | `branches.manage` |
| PATCH | `/branches/:id/deactivate` | `branches.manage` |
| GET | `/branches/:id/summary` | `machines.read` |
| GET | `/warehouses` | any authenticated |
| POST | `/warehouses` | `branches.manage` |

## `GET /branches/:id/summary`

```json
{
  "branch": { "id":"…", "name":"فرع الإسكندرية", "code":"ALX" },
  "machines": {
    "total": 214,
    "byStatus": { "IN_BRANCH_WAREHOUSE": 30, "WITH_REPRESENTATIVE": 12,
                  "WITH_MERCHANT": 160, "UNDER_MAINTENANCE": 8, "IN_TRANSIT": 4 }
  },
  "staff": { "supervisors": 2, "representatives": 11 },
  "openViolations": 6,
  "finance": { "monthExpenses": 42150.00, "monthIncome": 91300.00 }
}
```

The `finance` block is omitted entirely if the caller lacks `finance.read`.

## Business rules

1. Warehouse types are fixed: exactly one `COMPANY_MAIN`, exactly one `SCRAP`, one `BRANCH`
   warehouse per branch, one optional `MAINTENANCE` warehouse. Enforce with a partial unique index:
   ```sql
   CREATE UNIQUE INDEX uq_single_company_main ON warehouses (type) WHERE type = 'COMPANY_MAIN';
   CREATE UNIQUE INDEX uq_single_scrap        ON warehouses (type) WHERE type = 'SCRAP';
   CREATE UNIQUE INDEX uq_branch_warehouse    ON warehouses (branch_id) WHERE type = 'BRANCH';
   ```
2. A branch cannot be deactivated while it holds machines or has active staff → `409`.
3. **Inter-branch movement rule (explicit user requirement):** there is no
   `BRANCH_TO_BRANCH` transfer type. The path is
   `BRANCH_TO_COMPANY` → *(machine sits in company warehouse)* → `COMPANY_TO_BRANCH`.
   The transfer service must reject any attempt to construct a direct branch-to-branch move with
   `422 INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED`.
4. `branches.name` is operational data, not localized (per `02`).

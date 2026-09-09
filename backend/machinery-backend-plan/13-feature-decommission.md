# 13 — Feature: Decommission (end of life)

## Goal

The machine comes back to the warehouse, someone decides it is finished, and it is moved to the
scrap store. This is the terminal state of the lifecycle and the point where the whole cost story
is frozen for the record.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| POST | `/machines/:id/decommission` | `machines.decommission` |
| GET | `/machines/:id/decommission` | `machines.read` |
| GET | `/decommissions` | `machines.read` |
| GET | `/decommission-reasons` | any authenticated |
| GET | `/machines/decommission-candidates` | `machines.read` |

## DTO

```ts
export class DecommissionMachineDto {
  @IsUUID() reasonId: string;
  @IsString() @MinLength(5) @MaxLength(1000) notes: string;
  @IsDateString() decommissionedAt: string;
  @IsOptional() @ValidateNested() @Type(() => SignatureDto) signature?: SignatureDto;
}
```

## Flow (one DB transaction)

1. Assert the machine is physically at the company warehouse (`IN_COMPANY_WAREHOUSE`) — you cannot
   scrap something that is still with a merchant. Otherwise `422 MACHINE_NOT_IN_WAREHOUSE` with a
   message telling the caller to bring it back first.
2. Assert no open maintenance order → `409 OPEN_MAINTENANCE_ORDER`.
3. Assert not already decommissioned or replaced.
4. Snapshot the economics into the `decommissions` row:
   `cumulative_repair_cost_at_decision`, `purchase_price_at_decision`. These are frozen copies —
   later corrections to maintenance records must not rewrite history.
5. Create a `COMPANY_TO_SCRAP` transfer (so the movement is in the timeline like every other move).
6. Set `machines.status = DECOMMISSIONED`, `decommissioned_at`, `current_warehouse_id = scrap`,
   `current_holder_type = 'WAREHOUSE'`.
7. Audit log + notify the Director.

## Business rules

1. **Decommission is always a human decision.** The system may recommend; it never acts.
2. A decommissioned machine is fully read-only: no transfers, no maintenance, no replacement.
3. Decommission cannot be undone through the API. If it was a mistake, the Director uses a
   dedicated `POST /machines/:id/decommission/revert` guarded by `settings.manage`, requiring a
   reason, writing a loud audit entry, and returning the machine to `IN_COMPANY_WAREHOUSE`.
4. The battery is decommissioned with the machine — it is never harvested (per the permanent bond).
5. The machine record is **never** deleted. Reports must be able to include scrapped assets.

## `GET /machines/decommission-candidates`

The proactive list — the answer to "which machines are bleeding me money?"

Query params: `minCostRatio` (default 0.7), `minRepairCount` (default 5), `minAgeMonths`,
`branchId`, pagination.

```json
{
  "criteria": { "minCostRatio": 0.7, "minRepairCount": 5 },
  "data": [
    { "id":"…", "serial":"SN-00341", "model":"…", "status":"IN_COMPANY_WAREHOUSE",
      "purchasePrice": 4200.00, "cumulativeRepairCost": 3400.00, "costRatio": 0.81,
      "repairCount": 6, "ageMonths": 31, "isInChain": true, "chainLength": 2,
      "recommendation":"CONSIDER_DECOMMISSION",
      "lastMaintenanceAt":"2026-08-02" }
  ]
}
```

Implementation note: compute the ratio against **chain totals** (`12`) when the machine is part of a
replacement chain, otherwise against its own row.

## Thresholds live in settings, not code

```
DECOMMISSION_COST_RATIO_REVIEW    = 0.40
DECOMMISSION_COST_RATIO_CONSIDER  = 0.70
DECOMMISSION_REPAIR_COUNT_CONSIDER = 5
```

Stored in a `settings` key/value table, editable by the Director, cached in Redis.

## Tests

- decommissioning a machine held by a merchant → 422
- decommissioning with an open maintenance order → 409
- the decommission row freezes the cost snapshot even if a maintenance cost is later edited
- a decommissioned machine rejects new transfers
- candidates list respects chain totals

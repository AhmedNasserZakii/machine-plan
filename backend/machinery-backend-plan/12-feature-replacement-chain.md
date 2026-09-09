# 12 — Feature: Replacement Chain

## Goal

When a machine goes to the factory it may come back as the same serial, or the factory may swap it
for a completely different unit. The business explicitly wants a **replacement chain**: open the old
serial and see what replaced it; open the new serial and see what it replaced, all the way back to
the original.

## The core decision

A serial is immutable (`07`). Therefore a factory swap produces a **new machine record**, linked to
the old one — never an edit of the old record.

```
SN-00341  ──replaced_by──►  SN-00712  ──replaced_by──►  SN-01108
   │                            │                           │
 status: REPLACED           status: REPLACED         status: WITH_MERCHANT
```

## Endpoints

| Method | Path | Permission |
|---|---|---|
| POST | `/machines/:id/replace` | `machines.create` + `maintenance.close` |
| GET | `/machines/:id/replacement-chain` | `machines.read` |
| GET | `/replacements` | `machines.read` |

## DTO

```ts
export class ReplacementMachineDto {
  @IsString() @Length(3, 100) newSerial: string;
  @ValidateNested() @Type(() => CreateBatteryDto) newBattery: CreateBatteryDto;
  /** Same type-driven rule as intake: required when the type has `requiresSim`. */
  @IsOptional() @IsString() @Length(3, 100) newSimSerial?: string;
  @IsOptional() @IsString() @Length(3, 100) newBoxSerial?: string;
  @IsOptional() @IsUUID() machineModelId?: string;      // defaults to the old machine's model
  @IsOptional() @IsDateString() newWarrantyStart?: string;
  @IsOptional() @IsDateString() newWarrantyEnd?: string;
  @IsBoolean() hasBox: boolean;
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
  @IsDateString() replacedAt: string;
}
```

## Replace flow (one DB transaction)

1. Assert the old machine's status is `AT_FACTORY` or `IN_COMPANY_WAREHOUSE` and it is **not**
   already replaced (`replaced_by_machine_id IS NULL`), else `409 ALREADY_REPLACED`.
2. Assert `newSerial` and the new battery serial do not exist → `409 SERIAL_EXISTS`. Same for
   `newSimSerial` → `409 SIM_SERIAL_EXISTS` and `newBoxSerial` → `409 BOX_SERIAL_EXISTS`. A swapped
   SIM is a replacement rather than an edit (`07`, rule 1), so this is the only path by which a
   machine's SIM serial ever changes.
3. Create the **new** machine:
   - `machine_model_id`, `machine_type_id` inherited unless overridden;
   - `purchase_price` copied from the old machine (it is the same commercial asset for costing);
   - `purchase_date` copied — the asset's age does not reset;
   - warranty dates from the DTO (the factory usually issues a fresh warranty);
   - `status = IN_COMPANY_WAREHOUSE`, holder = company warehouse;
   - `replaces_machine_id = oldMachine.id`;
   - `total_repair_cost = 0`, `repair_count = 0` (fresh unit) — the *chain* total is computed, see below.
4. Create the bonded battery for the new machine.
5. Update the **old** machine: `status = REPLACED`, `replaced_by_machine_id = newMachine.id`,
   `current_holder_type = 'FACTORY'`, `current_holder_id = null`.
6. Insert `machine_replacements` (old, new, maintenance order, reason, replaced_at).
7. Close the linked maintenance order with `result = REPLACED`.
8. Audit log + notify the Director.

## `GET /machines/:id/replacement-chain`

Returns the whole chain regardless of which link you asked for. Implement with a recursive CTE:

```sql
WITH RECURSIVE back AS (
  SELECT m.* FROM machines m WHERE m.id = $1
  UNION ALL
  SELECT p.* FROM machines p JOIN back b ON p.id = b.replaces_machine_id
),
fwd AS (
  SELECT m.* FROM machines m WHERE m.id = $1
  UNION ALL
  SELECT c.* FROM machines c JOIN fwd f ON c.replaces_machine_id = f.id
)
SELECT * FROM back UNION SELECT * FROM fwd;
```

Response:

```json
{
  "requestedMachineId":"…",
  "chainLength": 3,
  "chain":[
    { "position": 1, "id":"…", "serial":"SN-00341", "status":"REPLACED",
      "activeFrom":"2025-02-10", "activeTo":"2026-03-02",
      "repairCount": 3, "repairCost": 1850.00,
      "replacedReason":"لوحة رئيسية تالفة" },
    { "position": 2, "id":"…", "serial":"SN-00712", "status":"REPLACED",
      "activeFrom":"2026-03-02", "activeTo":"2026-07-19",
      "repairCount": 1, "repairCost": 400.00 },
    { "position": 3, "id":"…", "serial":"SN-01108", "status":"WITH_MERCHANT",
      "activeFrom":"2026-07-19", "activeTo": null,
      "repairCount": 0, "repairCost": 0.00, "isCurrent": true }
  ],
  "chainTotals": {
    "purchasePrice": 4200.00,
    "cumulativeRepairCost": 2250.00,
    "cumulativeRepairCount": 4,
    "costToValueRatio": 0.54,
    "ageMonths": 19
  }
}
```

> `chainTotals` is what the Director actually needs: "this asset has cost me 2,250 over 4 repairs
> against a 4,200 purchase price". Per-machine numbers alone would hide the history behind every
> swap.

## Business rules

1. A machine can be replaced **at most once** — the chain is linear, never branching.
   Enforce with `UNIQUE(new_machine_id)` and `UNIQUE(old_machine_id)` on `machine_replacements`.
2. A `REPLACED` machine is read-only: no transfers, no maintenance, no decommission. It is history.
3. The new machine enters the world at the company warehouse and must be issued to a branch through
   a normal `COMPANY_TO_BRANCH` transfer. It does **not** teleport back to the merchant.
4. `GET /machines/:id/cost-summary` (`07`) must use `chainTotals`, not the single row, when the
   machine is part of a chain.
5. If the factory returns the **same** serial, this module is not involved at all — that is an
   ordinary maintenance `receive` + `close`.

## Tests

- replacing a machine twice → 409
- the new machine inherits purchase price and purchase date
- the old machine becomes read-only for transfers
- the chain query returns all three links from any of the three ids
- chain totals sum repair costs across all links

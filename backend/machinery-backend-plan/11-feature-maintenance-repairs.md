# 11 — Feature: Maintenance & Repairs

## Goal

A machine that stops working goes back up the chain to the company warehouse, then out to one of
three destinations depending on the fault: the internal workshop, the factory, or an external
service centre. The cost is recorded, the responsible party is decided **after** the repair, and the
expense is posted automatically into the finance module.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/maintenance-orders` | `maintenance.read` |
| GET | `/maintenance-orders/:id` | `maintenance.read` |
| POST | `/maintenance-orders` | `maintenance.create` |
| PATCH | `/maintenance-orders/:id` | `maintenance.update` |
| POST | `/maintenance-orders/:id/send` | `maintenance.update` — creates the outbound transfer |
| POST | `/maintenance-orders/:id/receive` | `maintenance.update` — creates the return transfer |
| POST | `/maintenance-orders/:id/close` | `maintenance.close` + `maintenance.set_cost` |
| POST | `/maintenance-orders/:id/cancel` | `maintenance.update` |
| GET | `/machines/:id/maintenance-history` | `maintenance.read` |
| GET | `/maintenance-locations` | any authenticated |

Filters: `machineId`, `status[]`, `locationId`, `responsibleParty`, `dateFrom`, `dateTo`,
`isFreeUnderWarranty`, `branchId`.

## DTOs

```ts
export class CreateMaintenanceOrderDto {
  @IsUUID() machineId: string;
  @IsUUID() locationId: string;                    // INTERNAL_WORKSHOP | FACTORY | SERVICE_CENTER
  @IsString() @MinLength(5) @MaxLength(1000) reportedFault: string;
  @IsDateString() sentAt: string;
  @IsOptional() @IsString() notes?: string;
}

export class CloseMaintenanceOrderDto {
  @IsEnum(MaintenanceResult) result: 'REPAIRED'|'REPLACED'|'UNREPAIRABLE';
  @IsBoolean() isFreeUnderWarranty: boolean;
  @ValidateIf(o => !o.isFreeUnderWarranty)
  @IsNumber() @Min(0) cost: number;

  @IsEnum(ResponsibleParty) responsibleParty: 'COMPANY'|'REPRESENTATIVE'|'MERCHANT'|'FACTORY';
  @ValidateIf(o => o.responsibleParty === 'REPRESENTATIVE') @IsUUID() responsibleUserId?: string;
  @ValidateIf(o => o.responsibleParty === 'MERCHANT') @IsUUID() responsibleMerchantId?: string;

  @ValidateIf(o => !o.isFreeUnderWarranty && o.responsibleParty === 'COMPANY')
  @IsUUID() paymentMethodId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() invoiceMediaId?: string;

  // required only when result === 'REPLACED'
  @ValidateIf(o => o.result === 'REPLACED') @ValidateNested()
  @Type(() => ReplacementMachineDto) replacement?: ReplacementMachineDto;

  @IsDateString() returnedAt: string;
  @IsOptional() @IsString() notes?: string;
}
```

## Warranty pre-computation

On create, the service computes and stores a **suggestion**:

```ts
const suggestedFree =
  machine.warrantyStart && machine.warrantyEnd &&
  isWithinInterval(new Date(dto.sentAt), { start: machine.warrantyStart, end: machine.warrantyEnd });
```

Returned to the client as `suggestedFreeUnderWarranty` so the app can pre-tick the checkbox. The
technician can override it on close — a fault outside the warranty terms is still chargeable during
the warranty window.

## Lifecycle

```
OPEN ──send──► IN_PROGRESS ──receive──► RETURNED ──close──► CLOSED
   └────────────────── cancel ──────────► CANCELLED
```

- **OPEN** — order created while the machine sits in the company warehouse.
- **send** — creates a transfer (`COMPANY_TO_MAINTENANCE` / `COMPANY_TO_FACTORY` /
  `COMPANY_TO_SERVICE_CENTER`), stores its id in `out_transfer_id`, machine status becomes
  `UNDER_MAINTENANCE` / `AT_FACTORY` / `AT_SERVICE_CENTER`.
- **receive** — creates the return transfer, stores `in_transfer_id`, machine returns to
  `IN_COMPANY_WAREHOUSE`. If the factory returned a **different serial**, this step feeds the
  replacement flow (`12`) instead.
- **close** — cost, warranty flag and responsible party are set; finance posting happens here.

## Close flow (one DB transaction)

1. Assert status is `RETURNED`.
2. Persist `result`, `cost`, `is_free_under_warranty`, `responsible_party`.
3. Update the machine aggregate:
   ```sql
   UPDATE machines
      SET total_repair_cost = total_repair_cost + :cost,
          repair_count = repair_count + 1
    WHERE id = :machineId;
   ```
   Free-under-warranty repairs still increment `repair_count` but add `0` to the cost.
4. **Finance posting — the automatic rule the business asked for:**
   - `isFreeUnderWarranty = true` → **no** finance transaction.
   - `responsibleParty = COMPANY` → insert an **EXPENSE** under the system category
     `MAINTENANCE`, `source = AUTO_MAINTENANCE`, `source_ref_type = 'maintenance_order'`,
     `branch_id = machine.current_branch_id`, `supplier_id`, `invoice_media_id` carried over.
   - `responsibleParty = REPRESENTATIVE` → create a `violations` row of type `PHYSICAL_DAMAGE`
     (or the mapped type) against `responsibleUserId` with `charged_amount = cost`, status
     `ACKNOWLEDGED`. The money is realised only when the violation is charged (`10`) — this keeps a
     single path for "money owed by a representative".
   - `responsibleParty = MERCHANT` → create an **INCOME** receivable record: a
     `finance_transactions` row is *not* created until collected; instead create a one-off
     `merchant_subscriptions` entry of type `ONE_TIME_FEE` linked to that merchant and machine.
   - `responsibleParty = FACTORY` → no finance transaction (the factory absorbed it).
5. If `result = REPLACED` → hand off to the Replacement module (`12`).
6. If `result = UNREPAIRABLE` → set machine status ready for decommission and notify the Director;
   do **not** auto-decommission (a human decides, per `13`).
7. Write the audit entry.

> **Idempotency:** closing an already-closed order returns `409 ORDER_ALREADY_CLOSED`. The finance
> posting must never run twice — guard with a unique index on
> `finance_transactions (source_ref_type, source_ref_id) WHERE source <> 'MANUAL'`.

## `GET /machines/:id/maintenance-history`

```json
{
  "machineId":"…", "serial":"SN-00341",
  "totals": { "orders": 3, "totalCost": 1850.00, "freeUnderWarranty": 1,
              "chargedToCompany": 1500.00, "chargedToRepresentative": 350.00 },
  "orders":[
    { "id":"…", "referenceNo":"MNT-2026-000087",
      "location": { "code":"FACTORY", "name":"المصنع" },
      "reportedFault":"الشاشة لا تعمل", "sentAt":"2026-02-14", "returnedAt":"2026-03-02",
      "result":"REPAIRED", "cost": 0, "isFreeUnderWarranty": true,
      "responsibleParty":"FACTORY", "status":"CLOSED" }
  ]
}
```

## Business rules

1. A machine can have **only one open maintenance order** at a time →
   `409 MACHINE_ALREADY_IN_MAINTENANCE`. Enforce with a partial unique index:
   ```sql
   CREATE UNIQUE INDEX uq_machine_open_maintenance ON maintenance_orders (machine_id)
     WHERE status IN ('OPEN','IN_PROGRESS','RETURNED');
   ```
2. Cost is required unless `isFreeUnderWarranty` is true.
3. Internal workshop technicians are **not** modelled as system users in v1 (explicit decision).
   The supervisor or Director records the workshop outcome on their behalf. Leave a
   `performed_by_name VARCHAR(150) NULL` free-text column so this can be upgraded later without a
   migration break.
4. A maintenance order cannot be opened for a `DECOMMISSIONED` or `REPLACED` machine.

## Tests

- opening a second order for the same machine → 409
- closing free-under-warranty creates no finance transaction but increments `repair_count`
- closing with `responsibleParty = COMPANY` creates exactly one expense under `MAINTENANCE`
- closing twice → 409 and no duplicate finance row
- `result = REPLACED` without a `replacement` payload → 400

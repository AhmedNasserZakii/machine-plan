# 07 — Feature: Machines & Batteries

## Goal

The machine is the central asset. It has a permanent serial, a permanently bonded battery with its
own serial, a SIM card serial and a carton serial, a model and type, a purchase price, a factory
free-maintenance window, and a live status telling you exactly where it is and who holds it.

Four serials identify one delivered unit — machine, battery, SIM and box. All four are scannable and
all four are permanent: none of them can be edited after intake.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/machines` | `machines.read` |
| GET | `/machines/:id` | `machines.read` |
| GET | `/machines/by-serial/:serial` | `machines.read` |
| GET | `/machines/lookup?code=` | `machines.read` — QR scan resolver, matches machine, battery, SIM **or** box serial |
| POST | `/machines` | `machines.create` |
| POST | `/machines/bulk` | `machines.import` — receive a factory batch |
| PATCH | `/machines/:id` | `machines.update` |
| GET | `/machines/:id/timeline` | `machines.read` — the full life story |
| GET | `/machines/:id/cost-summary` | `maintenance.read` |
| GET | `/machines/:id/replacement-chain` | `machines.read` |
| GET | `/machine-types` / `/machine-models` | any authenticated |
| POST | `/machine-types` / `/machine-models` | `settings.manage` |

### Filters on `GET /machines`

`search` (matches any of the four serials: machine, battery, SIM, box), `status[]`, `machineTypeId`,
`machineModelId`, `branchId`, `holderType`, `holderId`, `merchantId`, `warrantyExpiringBefore`,
`hasOpenMaintenance`, `minRepairCost`, `idleSinceDays`, pagination, sort.

### The lookup resolution order

`GET /machines/lookup?code=` and `search` both scan four columns, so one code could in principle
match two machines. Resolve in a fixed order — machine serial, battery serial, SIM serial, box
serial — and return the first hit, along with `matchedOn: 'MACHINE' | 'BATTERY' | 'SIM' | 'BOX'` so
the app can tell the user *what* it scanned. The uniqueness indexes make a genuine collision
possible only across different columns (a machine serial equal to another machine's box serial),
which the fixed order makes deterministic rather than arbitrary.

## DTOs

```ts
export class CreateMachineDto {
  @IsString() @Length(3, 100) serial: string;
  @IsUUID() machineModelId: string;
  @IsOptional() @IsString() qrPayload?: string;

  @ValidateNested() @Type(() => CreateBatteryDto) battery: CreateBatteryDto;

  /** Required when the model's machine type has `requiresSim`; rejected when it does not. */
  @IsOptional() @IsString() @Length(3, 100) simSerial?: string;

  /** Optional for every type — not every factory prints a carton serial. */
  @IsOptional() @IsString() @Length(3, 100) boxSerial?: string;

  @IsOptional() @IsNumber() @Min(0) purchasePrice?: number;
  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsString() factoryInvoiceNo?: string;

  @IsOptional() @IsDateString() warrantyStart?: string;
  @IsOptional() @IsDateString() warrantyEnd?: string;

  @IsBoolean() hasBox: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class CreateBatteryDto {
  @IsString() @Length(3, 100) serial: string;
}
```

`POST /machines/bulk` takes `{ machines: CreateMachineDto[] }`, validates the whole array first,
and either commits all or rejects all with a per-row error list. This is the factory-intake screen.

## Business rules

1. **Every serial is immutable.** Reject any `PATCH` containing `serial`, `simSerial` or `boxSerial`
   with `422 SERIAL_IMMUTABLE`, naming the offending field in `details`. The only way a serial
   "changes" is a factory replacement, which creates a *new* machine record and links it (see `12`).
   A swapped SIM is therefore a replacement, not an edit — this is deliberate: the SIM serial is
   part of the unit's identity, and letting it drift would break the audit trail of who was handed
   what.
1b. **SIM is required by type.** On create, if the model's machine type has `requires_sim = true`
   and `simSerial` is absent → `400 VALIDATION_FAILED` with
   `details: [{ field: 'simSerial', constraint: 'required for this machine type' }]`. If the type
   has `requires_sim = false` (a `PIN_PAD`) and `simSerial` *is* present → the same 400, with
   `constraint: 'not applicable for this machine type'`. Duplicates are
   `409 SIM_SERIAL_EXISTS` / `409 BOX_SERIAL_EXISTS`, mirroring `SERIAL_EXISTS`.
2. **Battery is 1↔1 and permanent.** `batteries.machine_id` is UNIQUE. There is no endpoint to
   move a battery between machines. If reality forces it, the Director does it through a dedicated
   audited operation `PATCH /machines/:id/battery` guarded by `settings.manage`, which writes an
   audit entry and a `BATTERY_MISMATCH` note on the machine.
3. **Charger has no serial and no record.** It exists only as `has_charger` on each transfer item.
4. `hasBox` on the machine reflects the *current* carton state. It is updated from each confirmed
   transfer item, because the representative must hand the machine over in the same packaging state
   in which he received it. `boxSerial` is separate and never changes: it is *which* carton, not
   *whether* the carton is present.
5. Warranty: `warranty_start` / `warranty_end` define the free-maintenance window. When a
   maintenance order is opened, the service pre-computes
   `isFreeUnderWarranty = sent_at BETWEEN warranty_start AND warranty_end`, but the technician can
   still override it when closing the order (some faults aren't covered).
6. `status` and `current_holder_*` are **read-only through this module**. Only the Transfer engine
   (`09`), Maintenance (`11`), Replacement (`12`) and Decommission (`13`) may change them.
7. A machine cannot be deleted, only decommissioned.

## `GET /machines/:id` — detail response

```json
{
  "id":"…", "serial":"SN-00341", "qrPayload":"SN-00341",
  "simSerial":"8920011234567890123", "boxSerial":"BX-00341",
  "type": { "id":"…", "name":"ماكينة نقاط بيع", "requiresSim": true },
  "model": { "id":"…", "name":"…", "manufacturer":"…" },
  "battery": { "id":"…", "serial":"BT-91223" },
  "status": "WITH_MERCHANT",
  "hasBox": true,
  "branch": { "id":"…", "name":"فرع الإسكندرية" },
  "holder": { "type":"MERCHANT", "id":"…", "name":"محل النور", "since":"2026-04-11T…" },
  "custodyChain": [
    { "type":"REPRESENTATIVE", "id":"…", "name":"أحمد سالم" }
  ],
  "purchase": { "price": 4200.00, "date":"2025-02-10", "invoiceNo":"F-2231" },
  "warranty": { "start":"2025-02-10", "end":"2026-02-10", "isActive": false, "daysRemaining": 0 },
  "maintenance": { "repairCount": 3, "totalRepairCost": 1850.00,
                   "costVsPricePercent": 44.0, "openOrder": null },
  "replacement": { "replaces": null, "replacedBy": null },
  "openViolations": 1
}
```

`custodyChain` matters: a machine at a merchant is still ultimately the responsibility of the
representative who placed it. Keep both.

## `GET /machines/:id/timeline`

Merged, reverse-chronological event stream assembled from transfers, maintenance orders,
violations, replacements and decommission:

```json
{
  "machineId":"…",
  "events":[
    { "at":"2026-04-11T09:12:00Z", "type":"TRANSFER_CONFIRMED",
      "title":"تم التسليم للتاجر", "from":"أحمد سالم (مندوب)", "to":"محل النور",
      "refId":"…", "refNo":"TRF-2026-000141",
      "details": { "hasCharger": true, "hasBox": true, "batteryMatches": true } },
    { "at":"2026-03-02T…", "type":"MAINTENANCE_CLOSED",
      "title":"رجعت من المصنع", "details": { "cost": 0, "free": true, "result":"REPAIRED" } },
    { "at":"2026-02-27T…", "type":"VIOLATION_CREATED",
      "title":"بطارية غير مطابقة", "details": { "againstUser":"…", "severity":"HIGH" } }
  ]
}
```

Implementation: one `UNION ALL` query over the source tables projected into a common shape, ordered
by `at DESC`, paginated with a keyset cursor. Do **not** build this in application memory.

## `GET /machines/:id/cost-summary`

Answers "is this machine still worth keeping?" — feeds the decommission decision (`13`).

```json
{
  "purchasePrice": 4200.00,
  "totalRepairCost": 1850.00,
  "repairCount": 3,
  "costToValueRatio": 0.44,
  "chargedToCompany": 1500.00,
  "chargedToRepresentatives": 350.00,
  "freeUnderWarranty": 0.00,
  "ageMonths": 19,
  "recommendation": "REVIEW"
}
```

`recommendation` is a simple, configurable heuristic — never an automatic action:
`KEEP` (<40%), `REVIEW` (40–70%), `CONSIDER_DECOMMISSION` (>70% or repairCount ≥ 5).
Thresholds live in settings, not in code constants.

## Indexes required

```sql
CREATE UNIQUE INDEX uq_machines_serial ON machines (serial) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_machines_sim_serial ON machines (sim_serial)
  WHERE deleted_at IS NULL AND sim_serial IS NOT NULL;
CREATE UNIQUE INDEX uq_machines_box_serial ON machines (box_serial)
  WHERE deleted_at IS NULL AND box_serial IS NOT NULL;
CREATE UNIQUE INDEX uq_batteries_serial ON batteries (serial) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_batteries_machine ON batteries (machine_id);
CREATE INDEX idx_machines_status ON machines (status);
CREATE INDEX idx_machines_holder ON machines (current_holder_type, current_holder_id);
CREATE INDEX idx_machines_branch_status ON machines (current_branch_id, status);
CREATE INDEX idx_machines_warranty_end ON machines (warranty_end) WHERE warranty_end IS NOT NULL;
```

## Tests

- duplicate serial → 409
- duplicate battery serial → 409
- duplicate SIM serial → 409 `SIM_SERIAL_EXISTS`; duplicate box serial → 409 `BOX_SERIAL_EXISTS`
- PATCH serial → 422; PATCH simSerial → 422; PATCH boxSerial → 422
- creating a `POS_TERMINAL` without `simSerial` → 400 naming the field
- creating a `PIN_PAD` *with* a `simSerial` → 400 naming the field
- creating a machine with no `boxSerial` succeeds for every type
- bulk import with one bad row → whole batch rejected, per-row errors returned
- lookup resolves the machine by machine, battery, SIM and box serial, and reports `matchedOn`
- two machines may both have a null SIM and a null box serial (the partial index allows it)

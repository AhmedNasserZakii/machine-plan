# 09 — Feature: Transfers (the hand-off engine)

> **This is the heart of the system.** Nothing else may mutate a machine's location or holder.
> If you are tempted to write `machine.status = X` anywhere outside this module, stop.

## Goal

Model every physical hand-off as a two-step event: the sender **creates** the transfer, the
receiver **confirms** it with a drawn signature or biometric verification. Until confirmation, the
machine is `IN_TRANSIT` and belongs to nobody.

## The custody graph

```
                    ┌──────────┐
                    │ FACTORY  │
                    └────┬─▲───┘
       FACTORY_TO_COMPANY│ │COMPANY_TO_FACTORY
                    ┌────▼─┴──────────┐
      ┌────────────►│ COMPANY WAREHOUSE│◄───────────┐
      │             └────┬─▲───────────┘            │
      │ BRANCH_TO_COMPANY│ │COMPANY_TO_BRANCH       │ MAINTENANCE_TO_COMPANY
      │             ┌────▼─┴───────┐                │ SERVICE_CENTER_TO_COMPANY
      │             │BRANCH (SUPER)│      ┌─────────┴──────────┐
      │             └────┬─▲───────┘      │ INTERNAL WORKSHOP  │
      │ REP_TO_BRANCH    │ │BRANCH_TO_REP │ SERVICE CENTER     │
      │             ┌────▼─┴────────┐     └────────────────────┘
      └─────────────┤ REPRESENTATIVE│              ▲
                    └────┬─▲────────┘              │ COMPANY_TO_MAINTENANCE
     REP_TO_MERCHANT     │ │ MERCHANT_TO_REP       │ COMPANY_TO_SERVICE_CENTER
                    ┌────▼─┴────────┐              │
                    │   MERCHANT    │              │
                    └───────────────┘        ┌─────▼──────┐
                                             │   SCRAP    │ COMPANY_TO_SCRAP
                                             └────────────┘
```

**No edge exists between two branches, or between two representatives.** This is enforced, not
merely documented.

## Allowed transitions table (implement as a constant map)

```ts
// src/modules/transfers/transfer-rules.ts
export const TRANSFER_RULES: Record<TransferType, TransferRule> = {
  FACTORY_TO_COMPANY: {
    from: 'FACTORY', to: 'WAREHOUSE',
    allowedFromStatuses: [],                       // new machines have no prior status
    resultStatus: 'IN_COMPANY_WAREHOUSE',
    signatures: ['RECEIVER'],
    requiredPermission: 'transfers.create',
  },
  COMPANY_TO_BRANCH: {
    from: 'WAREHOUSE', to: 'SUPERVISOR',
    allowedFromStatuses: ['IN_COMPANY_WAREHOUSE'],
    resultStatus: 'IN_BRANCH_WAREHOUSE',
    signatures: ['RECEIVER'],
    requiredPermission: 'transfers.create',
  },
  BRANCH_TO_REPRESENTATIVE: {
    from: 'SUPERVISOR', to: 'REPRESENTATIVE',
    allowedFromStatuses: ['IN_BRANCH_WAREHOUSE', 'WITH_SUPERVISOR'],
    resultStatus: 'WITH_REPRESENTATIVE',
    signatures: ['RECEIVER'],
    sameBranchRequired: true,
  },
  REPRESENTATIVE_TO_MERCHANT: {
    from: 'REPRESENTATIVE', to: 'MERCHANT',
    allowedFromStatuses: ['WITH_REPRESENTATIVE'],
    resultStatus: 'WITH_MERCHANT',
    signatures: ['SENDER'],        // merchant does not sign — sender self-attests
    autoConfirm: true,             // no counterparty account exists
  },
  MERCHANT_TO_REPRESENTATIVE: {
    from: 'MERCHANT', to: 'REPRESENTATIVE',
    allowedFromStatuses: ['WITH_MERCHANT'],
    resultStatus: 'WITH_REPRESENTATIVE',
    signatures: ['RECEIVER'],
    autoConfirm: true,
  },
  REPRESENTATIVE_TO_BRANCH: {
    from: 'REPRESENTATIVE', to: 'SUPERVISOR',
    allowedFromStatuses: ['WITH_REPRESENTATIVE'],
    resultStatus: 'IN_BRANCH_WAREHOUSE',
    signatures: ['RECEIVER'],
    sameBranchRequired: true,
    runViolationChecks: true,      // ← the return leg is where violations are detected
  },
  BRANCH_TO_COMPANY: { … resultStatus: 'IN_COMPANY_WAREHOUSE', signatures: ['RECEIVER'] },
  COMPANY_TO_MAINTENANCE:     { … resultStatus: 'UNDER_MAINTENANCE' },
  MAINTENANCE_TO_COMPANY:     { … resultStatus: 'IN_COMPANY_WAREHOUSE' },
  COMPANY_TO_FACTORY:         { … resultStatus: 'AT_FACTORY' },
  FACTORY_TO_COMPANY_RETURN:  { … resultStatus: 'IN_COMPANY_WAREHOUSE' },
  COMPANY_TO_SERVICE_CENTER:  { … resultStatus: 'AT_SERVICE_CENTER' },
  SERVICE_CENTER_TO_COMPANY:  { … resultStatus: 'IN_COMPANY_WAREHOUSE' },
  COMPANY_TO_SCRAP:           { … resultStatus: 'DECOMMISSIONED' },
};
```

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/transfers` | `transfers.read` |
| GET | `/transfers/:id` | `transfers.read` |
| POST | `/transfers` | `transfers.create` |
| POST | `/transfers/:id/confirm` | `transfers.confirm` |
| POST | `/transfers/:id/reject` | `transfers.reject` |
| POST | `/transfers/:id/cancel` | `transfers.cancel` |
| GET | `/transfers/pending/incoming` | `transfers.read` — my inbox |
| GET | `/transfers/pending/outgoing` | `transfers.read` — awaiting the other side |
| POST | `/transfers/validate` | `transfers.create` — dry run, no writes |

Filters: `type[]`, `status[]`, `branchId`, `fromPartyId`, `toPartyId`, `machineId`, `dateFrom`,
`dateTo`, `hasViolations`.

## Create DTO

```ts
export class CreateTransferDto {
  @IsUUID() clientUuid: string;                 // generated offline on the device
  @IsEnum(TransferType) type: TransferType;

  @IsOptional() @IsUUID() toPartyId?: string;   // user id / merchant id / warehouse id
  @IsDateString() occurredAt: string;           // device local time of the real hand-off

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => TransferItemDto)
  items: TransferItemDto[];

  @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @IsOptional() @ValidateNested() @Type(() => SignatureDto) senderSignature?: SignatureDto;
}

export class TransferItemDto {
  @IsUUID() machineId: string;
  @IsOptional() @IsString() batterySerialScanned?: string;
  @IsOptional() @IsString() simSerialScanned?: string;
  @IsOptional() @IsString() boxSerialScanned?: string;
  @IsBoolean() hasCharger: boolean;
  @IsBoolean() hasBox: boolean;
  @IsEnum(ItemCondition) condition: 'GOOD'|'DAMAGED'|'NOT_WORKING';
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsUUID('4', { each: true }) photoMediaIds?: string[];
}

export class SignatureDto {
  @IsEnum(SignatureMethod) method: 'DRAWN_SIGNATURE'|'BIOMETRIC';
  @IsOptional() @IsUUID() signatureMediaId?: string;   // required when DRAWN_SIGNATURE
  @IsOptional() @IsString() deviceId?: string;         // required when BIOMETRIC
  @IsOptional() @IsString() deviceModel?: string;
}
```

**One transfer, many machines, one signature.** The signature covers the whole document — that is
exactly how the paper process works today.

## Create flow (inside one DB transaction)

1. Resolve `TRANSFER_RULES[dto.type]`.
2. Check idempotency: if `client_uuid` already exists, return the stored response (`20`).
3. Verify the caller is a legitimate sender for this type (their role matches `rule.from`, and for
   `sameBranchRequired`, sender and receiver share a branch).
4. Load all machines with `SELECT … FOR UPDATE` to prevent double-dispatch.
5. For every machine assert:
   - `status ∈ rule.allowedFromStatuses`, else `422 INVALID_MACHINE_STATUS`;
   - `current_holder` really is the sender, else `422 NOT_IN_YOUR_CUSTODY`;
   - not `DECOMMISSIONED` / `REPLACED`, else `422 MACHINE_RETIRED`;
   - no other `PENDING` transfer references it, else `409 MACHINE_ALREADY_IN_TRANSIT`.
6. Compute `battery_matches` per item by comparing `batterySerialScanned` to the bonded battery.
   Likewise `sim_matches` and `box_matches` against `machines.sim_serial` / `machines.box_serial`,
   leaving each `NULL` when the corresponding serial was not scanned — a scan that did not happen
   is not the same as a mismatch. These are recorded now; the violation types that act on them
   arrive with the rest of the auto-detection rules (`10`).
7. Insert `transfers` + `transfer_items` + photos. Generate `reference_no`.
8. Store the sender signature if provided.
9. Set every machine to `IN_TRANSIT`.
10. If `rule.autoConfirm` → immediately run the confirm flow with the sender as confirmer.
11. Otherwise notify the receiver (`18`).

## Confirm flow

`POST /transfers/:id/confirm`

```ts
export class ConfirmTransferDto {
  @ValidateNested() @Type(() => SignatureDto) signature: SignatureDto;
  @IsString() payloadHash: string;                 // client-computed hash of what it displayed
  @IsOptional() @ValidateNested({ each: true }) @Type(() => ItemAdjustmentDto)
  adjustments?: ItemAdjustmentDto[];               // receiver corrects what he actually got
}

export class ItemAdjustmentDto {
  @IsUUID() transferItemId: string;
  @IsOptional() @IsBoolean() hasCharger?: boolean;
  @IsOptional() @IsBoolean() hasBox?: boolean;
  @IsOptional() @IsString() batterySerialScanned?: string;
  @IsOptional() @IsString() simSerialScanned?: string;
  @IsOptional() @IsString() boxSerialScanned?: string;
  @IsOptional() @IsEnum(ItemCondition) condition?: ItemCondition;
  @IsOptional() @IsString() notes?: string;
}
```

Inside one transaction:
1. Assert `status === 'PENDING'` and the caller is the designated receiver.
2. Recompute the server-side payload hash from the *current* item state; compare to the client's.
   Mismatch → `409 PAYLOAD_CHANGED`, forcing the receiver to re-read before signing.
3. Apply `adjustments` — **the receiver's word wins**, because he is the one taking custody.
4. Re-evaluate `battery_matches`, `sim_matches` and `box_matches` after adjustments.
5. **Run violation checks** (`10`) when `rule.runViolationChecks` or when any adjustment
   contradicts the sender's declaration.
6. Store the receiver signature with the final `payload_hash`.
7. Update every machine: `status = rule.resultStatus`, `current_holder_*`, `current_branch_id`,
   `has_box = item.hasBox`.
8. Set transfer `status = CONFIRMED`, `confirmed_at`, `confirmed_by_user_id`.
9. Notify the sender.

## Reject flow

The receiver refuses the whole document with a mandatory reason. All machines revert to their
**previous** status (persist `previous_status` on the transfer item at creation time so this is a
clean rollback, not a guess). Sender is notified.

> Business note from the requirements: an individual mismatched machine is **not** rejected — it is
> accepted and a violation is logged. Rejection is for a whole delivery that never physically
> happened. Keep the two mechanisms distinct.

## Cancel flow

Only the sender, only while `PENDING`, only within a configurable window (default 24h).
Machines revert to `previous_status`.

## Auto-expiry job

A pending transfer older than `TRANSFER_PENDING_EXPIRY_HOURS` (default 72) triggers a reminder at
24h and 48h, and at 72h notifies the branch supervisor. It is **never** auto-confirmed or
auto-cancelled — a human always decides.

## `GET /transfers/:id` response

```json
{
  "id":"…", "referenceNo":"TRF-2026-000141", "type":"BRANCH_TO_REPRESENTATIVE",
  "status":"CONFIRMED",
  "from": { "type":"SUPERVISOR", "id":"…", "name":"محمود عادل" },
  "to":   { "type":"REPRESENTATIVE", "id":"…", "name":"أحمد سالم" },
  "branch": { "id":"…", "name":"فرع الإسكندرية" },
  "occurredAt":"2026-09-01T10:22:00Z", "confirmedAt":"2026-09-01T10:24:11Z",
  "itemsCount": 12,
  "items":[
    { "id":"…", "machine": { "id":"…","serial":"SN-00341","model":"…" },
      "batterySerialScanned":"BT-91223", "batteryMatches": true,
      "simSerialScanned":"8920011234567890123", "simMatches": true,
      "boxSerialScanned": null, "boxMatches": null,
      "hasCharger": true, "hasBox": true, "condition":"GOOD",
      "photos":[ { "id":"…","url":"…" } ], "violations": [] }
  ],
  "signatures":[
    { "partyRole":"RECEIVER", "user": { "id":"…","fullName":"أحمد سالم" },
      "method":"BIOMETRIC", "signedAt":"2026-09-01T10:24:11Z",
      "deviceModel":"Samsung A54", "payloadHash":"9f2c…" }
  ],
  "violationsCount": 0,
  "notes": null
}
```

## Concurrency

- `SELECT … FOR UPDATE` on machines during create and confirm.
- Partial unique index preventing two pending transfers for one machine:
  ```sql
  CREATE UNIQUE INDEX uq_machine_pending_transfer
    ON transfer_items (machine_id)
    WHERE transfer_id IN (SELECT id FROM transfers WHERE status = 'PENDING');
  ```
  (If the sub-select is not allowed in your PG version, enforce with a trigger or an explicit
  `machine_locks` table — do not rely on application checks alone.)

## Tests (mandatory)

- creating a transfer for a machine not in your custody → 422
- creating a second transfer for an in-transit machine → 409
- confirming with a stale `payloadHash` → 409
- confirming with adjustments that reveal a battery mismatch → violation auto-created
- rejecting restores the exact previous statuses
- a direct branch-to-branch attempt → 422
- `REPRESENTATIVE_TO_MERCHANT` auto-confirms with one signature
- replaying the same `clientUuid` returns the original response, creates nothing new

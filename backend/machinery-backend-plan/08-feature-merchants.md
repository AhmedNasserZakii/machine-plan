# 08 — Feature: Merchants

## Goal

The merchant is the final destination of a machine. The representative registers the merchant and
places machines with him. Merchants may pay an up-front fee, a weekly or monthly subscription, or
nothing at all.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/merchants` | `merchants.read` |
| GET | `/merchants/:id` | `merchants.read` |
| POST | `/merchants` | `merchants.create` |
| PATCH | `/merchants/:id` | `merchants.update` |
| PATCH | `/merchants/:id/deactivate` | `merchants.delete` |
| GET | `/merchants/:id/machines` | `merchants.read` |
| GET | `/merchants/:id/timeline` | `merchants.read` |
| GET | `/merchants/:id/subscriptions` | `merchants.read` |
| POST | `/merchants/:id/subscriptions` | `merchants.update` |
| PATCH | `/subscriptions/:id` | `merchants.update` |
| POST | `/subscriptions/:id/collect` | `finance.create` |

Filters on `GET /merchants`: `search` (name / shop / phone), `branchId`, `createdByUserId`,
`hasMachines`, `isActive`.

## DTO

```ts
export class CreateMerchantDto {
  @IsString() @Length(3, 150) name: string;
  @IsPhoneNumber('EG') phone: string;
  @IsString() @Length(2, 150) shopName: string;
  @IsString() @Length(5, 500) address: string;
  @IsOptional() @Matches(/^\d{14}$/) nationalId?: string;   // Egyptian NID, optional
}
```

`branchId` and `createdByUserId` are taken from the authenticated user, **never** from the body.

## Business rules

1. Required: name, phone, shop name, address. Optional: national ID.
2. Duplicate detection is a **warning, not a block**: if a merchant with the same phone exists in
   the same branch, return `200` with `{ "warning": "DUPLICATE_PHONE", "existing": {…} }` when
   `?checkOnly=true`, and allow creation anyway. Field reality beats data purity here.
3. National ID, when supplied, must be unique across the system (partial unique index).
4. A representative can only see merchants he created, unless he has `merchants.read.all`.
   Supervisors see their whole branch. Director sees everything.
5. A merchant cannot be deactivated while holding machines → `409 MERCHANT_HAS_MACHINES`, with the
   list. The machines must be pulled back through a `MERCHANT_TO_REPRESENTATIVE` transfer first.
6. The merchant **does not sign** anything. Only the representative records the placement and
   signs it — per the stated process. So `REPRESENTATIVE_TO_MERCHANT` transfers require exactly one
   signature (the representative's), unlike every other transfer type.

## `GET /merchants/:id` response

```json
{
  "id":"…", "name":"…", "shopName":"…", "phone":"…", "address":"…", "nationalId":"…",
  "branch": { "id":"…", "name":"…" },
  "registeredBy": { "id":"…", "fullName":"أحمد سالم" },
  "machinesCount": 3,
  "activeSubscription": { "planType":"MONTHLY", "amount": 350.00, "nextDueDate":"2026-10-01" },
  "totalPaid": 4200.00,
  "isActive": true
}
```

## Subscriptions

```ts
export class CreateSubscriptionDto {
  @IsEnum(SubscriptionPlanType) planType: 'NONE'|'ONE_TIME_FEE'|'WEEKLY'|'MONTHLY';
  @IsOptional() @IsUUID() machineId?: string;     // per-machine or merchant-wide
  @IsNumber() @Min(0) amount: number;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
}
```

- `NONE` → amount must be 0; no dues generated.
- `ONE_TIME_FEE` → one collection expected at `startDate`; `nextDueDate` becomes null after collection.
- `WEEKLY` / `MONTHLY` → `nextDueDate` rolls forward on each collection.

### `POST /subscriptions/:id/collect`

```ts
export class CollectSubscriptionDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsDateString() collectedAt: string;
  @IsUUID() paymentMethodId: string;
  @IsOptional() @IsUUID() invoiceMediaId?: string;
  @IsOptional() @IsString() notes?: string;
}
```

In one transaction:
1. insert a `finance_transactions` row: `kind = INCOME`,
   `category = MERCHANT_SUBSCRIPTIONS` (system category), `source = AUTO_SUBSCRIPTION`,
   `source_ref_type = 'merchant_subscription'`, `branch_id = merchant.branch_id`;
2. roll `next_due_date` forward by the plan period;
3. write an audit entry.

A nightly job flags overdue subscriptions and notifies the branch supervisor (`18`).

## Tests

- creating a merchant without an address → 400
- duplicate national ID → 409
- deactivating a merchant holding machines → 409
- collecting a subscription creates exactly one income transaction under the system category

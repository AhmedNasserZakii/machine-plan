# 13 — Feature: Merchants

Mobile counterpart: `mobile-app/lib/feature/merchants/`.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET | `merchants` | list |
| POST | `merchants` | create |
| POST | `merchants/check` | duplicate pre-check in the form |
| GET | `merchants/pickable` | transfer recipient picker (`12`) |
| GET | `merchants/{id}` | detail |
| PATCH | `merchants/{id}` | edit |
| PATCH | `merchants/{id}/deactivate` | deactivate |
| GET | `merchants/{id}/machines` | machines tab |
| GET/POST | `merchants/{id}/subscriptions` | subscriptions tab |
| GET | `merchants/{id}/timeline` | timeline tab |
| PATCH | `subscriptions/{id}` | edit a subscription |
| POST | `subscriptions/{id}/collect` | record a collection |

## `/merchants` — list

Columns: name (sticky) · shop name · phone (`<PhoneText>`) · national ID (mono, LTR) ·
branch · representative · machine count · active subscription · status · created at.

Sortable: `createdAt`, `name`, `shopName`.

Filters: `search` (name / shop / phone / national ID) · `branchId` (`merchants.read.all` only) ·
`isActive` · `representativeId` · `hasMachines`.

Actions: New merchant (`merchants.create`) · Export (`reports.export`).

## Merchant form

Sections: identity (full name, national ID, phone, alternate phone) · shop (shop name, address,
area, landmark) · assignment (branch, representative) · notes.

**Duplicate pre-check** — call `POST merchants/check` on national-ID blur, before submit. The
endpoint is idempotency-exempt precisely so it can be called this way. If a match comes back, show
the existing merchant inline with a link, and let the user either open it or continue deliberately.
`DUPLICATE_NATIONAL_ID` at submit means the pre-check was skipped or raced; map it to the field.

Validation: Egyptian national ID = 14 digits; phone `^01[0125][0-9]{8}$`; both `dir="ltr"` mono.

## `/merchants/[id]` — detail

Header: name · shop name · status chip · branch · representative · actions.
Rail: contact block with click-to-call and copy · address · assigned representative ·
counts (machines held, active subscriptions, open violations linked).

Tabs:

| Tab | Source |
|---|---|
| profile | `merchants/{id}` |
| machines | `merchants/{id}/machines` — table, each row links to the machine |
| subscriptions | `merchants/{id}/subscriptions` — amount, period (`DAY`/`WEEK`/`MONTH`/`YEAR`), next due, status |
| timeline | `merchants/{id}/timeline` — placements, returns, collections, violations |

Actions: Edit (`merchants.update`) · Deactivate (`merchants.delete`) · Place a machine
(`transfers.create`, jumps into the wizard pre-filled with `REPRESENTATIVE_TO_MERCHANT` and this
merchant) · Collect from a machine (`transfers.create`, `MERCHANT_TO_REPRESENTATIVE`) ·
Add subscription · Record collection.

**Deactivate** must refuse while the merchant holds machines: `MERCHANT_HAS_MACHINES`. Do not
present it as a generic failure — list the machines they still hold and link to the transfer
wizard to collect them. That is the action the user actually needs.

## Subscriptions

Create: amount, period, start date, payment method (`payment-methods`), notes.
Collect: `POST subscriptions/{id}/collect` with amount, date, payment method — the backend creates
an `AUTO_SUBSCRIPTION` finance transaction as a side effect, so **invalidate `financeKeys.all`**
(`07`) or the accountant's screen shows a stale total.

Overdue subscriptions are flagged in the list and on the dashboard.

## Acceptance

- [ ] Duplicate pre-check runs on national-ID blur and offers the existing record.
- [ ] Deactivate with held machines shows the machines and the way out.
- [ ] Collecting a subscription invalidates finance queries.
- [ ] Phones and national IDs render LTR in Arabic.
- [ ] Branch filter appears only for `merchants.read.all`.

# 03 — Database Schema (source of truth)

All tables carry the base columns from `01`. Translation tables follow `02`.
Types are PostgreSQL. Money is `NUMERIC(14,2)` — never floats.

---

## A. Identity & access

### `users`
| Column | Type | Notes |
|---|---|---|
| full_name | VARCHAR(150) | |
| phone | VARCHAR(20) UNIQUE | login identifier |
| email | VARCHAR(150) NULL UNIQUE | optional |
| password_hash | VARCHAR(255) | argon2id |
| role_id | UUID FK roles | one primary role |
| branch_id | UUID FK branches NULL | NULL for company-level users |
| is_active | BOOLEAN DEFAULT true | |
| must_change_password | BOOLEAN DEFAULT true | manager creates accounts → first login forces change |
| biometric_enabled | BOOLEAN DEFAULT false | |
| signature_image_url | TEXT NULL | stored reference signature |
| last_login_at | TIMESTAMPTZ NULL | |

Indexes: `phone`, `(role_id)`, `(branch_id)`.

### `roles`
`code` VARCHAR(50) UNIQUE, `is_system` BOOLEAN. + `role_translations(display_name, description)`.
Seeded codes: `DIRECTOR`, `BRANCH_SUPERVISOR`, `REPRESENTATIVE`, `ACCOUNTANT`, `VIEWER`.

### `permissions`
`code` VARCHAR(80) UNIQUE (`machines.create`), `group` VARCHAR(50). + `permission_translations`.

### `role_permissions`
`role_id`, `permission_id` — UNIQUE(role_id, permission_id).

### `user_permission_overrides`
`user_id`, `permission_id`, `effect` ENUM(`ALLOW`,`DENY`) — lets the Director grant/revoke a single
permission for one user without inventing a new role. **This is how "the manager decides who sees
the money" is implemented.**

### `refresh_tokens`
`user_id`, `token_hash`, `device_id`, `expires_at`, `revoked_at`.

---

## B. Organization

### `branches`
`code` VARCHAR(30) UNIQUE, `name` VARCHAR(150), `address` TEXT NULL, `phone` NULL, `is_active`.
> Branch name is operational, not localized.

### `warehouses`
`branch_id` NULL, `type` VARCHAR(30) CHECK IN (`COMPANY_MAIN`,`BRANCH`,`SCRAP`,`MAINTENANCE`),
`name`, `is_active`. Exactly one `COMPANY_MAIN` and one `SCRAP` seeded.

---

## C. Machines

### `machine_types` + `machine_type_translations`
`code`, `is_active`, `sort_order`, `requires_sim` BOOLEAN DEFAULT true.

`requires_sim` drives validation instead of a blanket `NOT NULL` on `machines.sim_serial`: a
`PIN_PAD` has no mobile line, while every POS variant does. Seed it `false` for `PIN_PAD` only.

### `machine_models` + `machine_model_translations`
`code`, `machine_type_id`, `manufacturer` VARCHAR(150) NULL, `is_active`.

### `machines`
| Column | Type | Notes |
|---|---|---|
| serial | VARCHAR(100) UNIQUE NOT NULL | never changes; scannable |
| sim_serial | VARCHAR(100) UNIQUE NULL | SIM card printed serial (ICCID); required when the type's `requires_sim` |
| box_serial | VARCHAR(100) UNIQUE NULL | carton serial, when the factory prints one |
| qr_payload | TEXT NULL | value encoded on the sticker if ≠ serial |
| machine_model_id | UUID FK | |
| machine_type_id | UUID FK | denormalized for fast filtering |
| purchase_price | NUMERIC(14,2) NULL | |
| purchase_date | DATE NULL | |
| factory_invoice_no | VARCHAR(80) NULL | |
| warranty_start | DATE NULL | free-maintenance window start |
| warranty_end | DATE NULL | free-maintenance window end |
| status | VARCHAR(40) | see MachineStatus below |
| current_branch_id | UUID FK branches NULL | |
| current_warehouse_id | UUID FK warehouses NULL | set when in a warehouse |
| current_holder_type | VARCHAR(20) NULL | `WAREHOUSE`,`SUPERVISOR`,`REPRESENTATIVE`,`MERCHANT`,`FACTORY`,`SERVICE_CENTER` |
| current_holder_id | UUID NULL | polymorphic id |
| has_box | BOOLEAN DEFAULT false | current carton state — whether the carton is physically with the machine right now |
| total_repair_cost | NUMERIC(14,2) DEFAULT 0 | maintained by maintenance module |
| repair_count | INT DEFAULT 0 | |
| replaced_by_machine_id | UUID FK machines NULL | replacement chain forward pointer |
| replaces_machine_id | UUID FK machines NULL | backward pointer |
| decommissioned_at | TIMESTAMPTZ NULL | |
| notes | TEXT NULL | |

Indexes: `serial` (unique), `sim_serial` (unique, partial), `box_serial` (unique, partial),
`status`, `(current_holder_type, current_holder_id)`, `current_branch_id`, `machine_model_id`,
`warranty_end`.

`sim_serial` and `box_serial` are nullable, so their uniqueness is a **partial** index — Postgres
already treats `NULL`s as distinct, but the predicate also keeps soft-deleted rows out (see `07`).

**`MachineStatus` enum values**
```
IN_COMPANY_WAREHOUSE
IN_BRANCH_WAREHOUSE
WITH_SUPERVISOR
WITH_REPRESENTATIVE
WITH_MERCHANT
IN_TRANSIT            # transfer created, not yet confirmed
UNDER_MAINTENANCE     # internal
AT_FACTORY
AT_SERVICE_CENTER
DECOMMISSIONED
REPLACED              # superseded by a new serial from the factory
```

### `batteries`
| Column | Type | Notes |
|---|---|---|
| serial | VARCHAR(100) UNIQUE NOT NULL | |
| machine_id | UUID FK machines **UNIQUE** | 1↔1, permanent bond |
| is_active | BOOLEAN | |
| notes | TEXT NULL | |

> Business rule: a battery is bound to exactly one machine for life. If a battery arrives attached
> to the wrong machine, the hand-off is still **accepted** but a violation is logged (see `10`).

### Chargers
**Not modelled as a table.** A charger is a generic, untracked asset. It is captured per hand-off
as `transfer_items.has_charger BOOLEAN`. Absence of a charger is recorded and, when unexplained,
raises a violation.

### SIM cards and boxes
**Columns on `machines`, not tables.** Unlike the battery, neither has its own lifecycle to track:
they are identifiers printed on parts of the same delivered unit, so a column is enough and no
join is needed to answer "which machine is this?".

- `sim_serial` — the serial printed on the SIM. Required for machine types whose
  `requires_sim` is true, absent for a `PIN_PAD`.
- `box_serial` — the serial printed on the carton. Always optional; not every factory prints one.
- Both are **immutable**, exactly like `machines.serial`: a `PATCH` carrying either is rejected with
  `422 SERIAL_IMMUTABLE`. A machine that comes back from the factory with a different SIM is a
  *replacement* (`12`), which creates a new machine row.
- `has_box` stays a separate boolean and keeps its meaning: `box_serial` is the carton's **identity**,
  `has_box` is whether the carton is **currently with the machine**. A machine can have a known
  `box_serial` and `has_box = false` after a representative loses the carton.

---

## D. Merchants

### `merchants`
`name` VARCHAR(150) NOT NULL, `phone` VARCHAR(20) NOT NULL, `shop_name` VARCHAR(150) NOT NULL,
`address` TEXT NOT NULL, `national_id` VARCHAR(20) NULL, `branch_id` FK, `created_by_user_id` FK
(the representative), `is_active`.
Index: `phone`, `branch_id`. Partial unique on `national_id WHERE national_id IS NOT NULL`.

### `merchant_subscriptions`
| Column | Type | Notes |
|---|---|---|
| merchant_id | UUID FK | |
| machine_id | UUID FK NULL | subscription may be per machine |
| plan_type | VARCHAR(20) | `NONE`, `ONE_TIME_FEE`, `WEEKLY`, `MONTHLY` |
| amount | NUMERIC(14,2) | 0 when `NONE` |
| start_date | DATE | |
| end_date | DATE NULL | |
| next_due_date | DATE NULL | computed |
| is_active | BOOLEAN | |

Collected money posts into `finance_transactions` as income (see `15`).

---

## E. Transfers (the hand-off engine)

### `transfers`
| Column | Type | Notes |
|---|---|---|
| reference_no | VARCHAR(30) UNIQUE | human-readable, e.g. `TRF-2026-000141` |
| type | VARCHAR(40) | see TransferType below |
| direction | VARCHAR(10) | `OUT` / `RETURN` |
| from_party_type | VARCHAR(20) | `FACTORY`,`WAREHOUSE`,`SUPERVISOR`,`REPRESENTATIVE`,`MERCHANT`,`SERVICE_CENTER` |
| from_party_id | UUID NULL | |
| to_party_type | VARCHAR(20) | |
| to_party_id | UUID NULL | |
| branch_id | UUID FK NULL | scoping |
| status | VARCHAR(20) | `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED` |
| initiated_by_user_id | UUID FK | |
| confirmed_by_user_id | UUID FK NULL | |
| confirmed_at | TIMESTAMPTZ NULL | |
| rejection_reason | TEXT NULL | |
| notes | TEXT NULL | |
| client_uuid | UUID UNIQUE NULL | offline idempotency (see `20`) |
| occurred_at | TIMESTAMPTZ | real-world time from the device (may predate `created_at`) |

**`TransferType` values**
```
FACTORY_TO_COMPANY
COMPANY_TO_BRANCH
BRANCH_TO_REPRESENTATIVE
REPRESENTATIVE_TO_MERCHANT
MERCHANT_TO_REPRESENTATIVE
REPRESENTATIVE_TO_BRANCH
BRANCH_TO_COMPANY
COMPANY_TO_MAINTENANCE      # internal workshop
MAINTENANCE_TO_COMPANY
COMPANY_TO_FACTORY
FACTORY_TO_COMPANY_RETURN
COMPANY_TO_SERVICE_CENTER
SERVICE_CENTER_TO_COMPANY
COMPANY_TO_SCRAP
```

### `transfer_items`
| Column | Type | Notes |
|---|---|---|
| transfer_id | UUID FK | |
| machine_id | UUID FK | |
| battery_serial_scanned | VARCHAR(100) NULL | what was physically scanned |
| battery_matches | BOOLEAN | computed vs `batteries.serial` |
| sim_serial_scanned | VARCHAR(100) NULL | what was physically scanned |
| sim_matches | BOOLEAN NULL | computed vs `machines.sim_serial`; NULL when not scanned |
| box_serial_scanned | VARCHAR(100) NULL | what was physically scanned |
| box_matches | BOOLEAN NULL | computed vs `machines.box_serial`; NULL when not scanned |
| has_charger | BOOLEAN | |
| has_box | BOOLEAN | |
| condition | VARCHAR(20) | `GOOD`, `DAMAGED`, `NOT_WORKING` |
| notes | TEXT NULL | |

UNIQUE(transfer_id, machine_id).

### `transfer_item_photos`
`transfer_item_id`, `media_id` FK media. Max 4 per item (enforced in service).

### `transfer_signatures`
| Column | Type | Notes |
|---|---|---|
| transfer_id | UUID FK | |
| user_id | UUID FK | who signed |
| party_role | VARCHAR(20) | `SENDER` / `RECEIVER` |
| method | VARCHAR(20) | `DRAWN_SIGNATURE` / `BIOMETRIC` |
| signature_media_id | UUID FK media NULL | drawn signature image |
| biometric_verified_at | TIMESTAMPTZ NULL | |
| device_id | VARCHAR(120) NULL | |
| device_model | VARCHAR(120) NULL | |
| ip_address | INET NULL | |
| signed_at | TIMESTAMPTZ NOT NULL | |
| payload_hash | VARCHAR(128) | SHA-256 of the transfer snapshot at signing time |

> `payload_hash` is what makes the signature meaningful: it proves *what* was signed for.

---

## F. Violations

### `violation_types` + `violation_type_translations`
`code`, `default_severity` VARCHAR(10) (`LOW`/`MEDIUM`/`HIGH`), `is_active`.
Seeded codes: `BATTERY_MISMATCH`, `MISSING_CHARGER`, `MISSING_BOX`, `PHYSICAL_DAMAGE`,
`LATE_RETURN`, `MISSING_MACHINE`, `OTHER`.

### `violations`
`violation_type_id`, `user_id` (the representative held responsible), `machine_id` NULL,
`transfer_id` NULL, `transfer_item_id` NULL, `severity`, `description` TEXT,
`status` VARCHAR(20) (`OPEN`,`ACKNOWLEDGED`,`WAIVED`,`CHARGED`,`CLOSED`),
`charged_amount` NUMERIC(14,2) NULL, `finance_transaction_id` UUID NULL,
`resolved_by_user_id` NULL, `resolved_at` NULL, `auto_generated` BOOLEAN.

Index: `(user_id, status)`, `machine_id`, `created_at`.

---

## G. Maintenance

### `maintenance_locations` + translations
`code` (`INTERNAL_WORKSHOP`, `FACTORY`, `SERVICE_CENTER`), `is_active`.

### `maintenance_orders`
| Column | Type | Notes |
|---|---|---|
| reference_no | VARCHAR(30) UNIQUE | `MNT-2026-000087` |
| machine_id | UUID FK | |
| location_id | UUID FK maintenance_locations | |
| reported_fault | TEXT | |
| sent_at | TIMESTAMPTZ | |
| returned_at | TIMESTAMPTZ NULL | |
| status | VARCHAR(20) | `OPEN`,`IN_PROGRESS`,`RETURNED`,`CLOSED`,`CANCELLED` |
| result | VARCHAR(20) NULL | `REPAIRED`,`REPLACED`,`UNREPAIRABLE` |
| cost | NUMERIC(14,2) NULL | filled on close |
| is_free_under_warranty | BOOLEAN DEFAULT false | |
| responsible_party | VARCHAR(20) NULL | `COMPANY`,`REPRESENTATIVE`,`MERCHANT`,`FACTORY` |
| responsible_user_id | UUID FK users NULL | when `REPRESENTATIVE` |
| responsible_merchant_id | UUID FK NULL | when `MERCHANT` |
| finance_transaction_id | UUID FK NULL | auto-posted expense (see `20` of finance) |
| out_transfer_id / in_transfer_id | UUID FK transfers NULL | links to the physical movement |
| notes | TEXT NULL | |

Index: `machine_id`, `status`, `sent_at`.

### `machine_replacements`
`old_machine_id` FK, `new_machine_id` FK UNIQUE, `maintenance_order_id` FK NULL,
`reason` TEXT, `replaced_at` TIMESTAMPTZ, `created_by`.
UNIQUE(old_machine_id, new_machine_id).

### `decommissions`
`machine_id` FK UNIQUE, `reason_id` FK decommission_reasons, `notes` TEXT,
`decided_by_user_id`, `decommissioned_at`, `scrap_warehouse_id` FK,
`cumulative_repair_cost_at_decision` NUMERIC(14,2), `purchase_price_at_decision` NUMERIC(14,2).

### `decommission_reasons` + translations
`code` (`BEYOND_REPAIR`, `NOT_COST_EFFECTIVE`, `OBSOLETE`, `LOST`, `STOLEN`, `OTHER`).

---

## H. Finance

### `finance_categories` + `finance_category_translations`
| Column | Type | Notes |
|---|---|---|
| code | VARCHAR(60) NULL UNIQUE | only for system categories |
| parent_id | UUID FK self NULL | unlimited nesting |
| path | LTREE **or** VARCHAR(500) materialized path | `root.maintenance.spare_parts` |
| depth | INT | derived |
| kind | VARCHAR(10) | `EXPENSE` / `INCOME` |
| is_system | BOOLEAN | system categories cannot be deleted |
| is_active | BOOLEAN | |
| sort_order | INT | |

Index: `parent_id`, `path` (GIST if LTREE), `kind`.
Seeded system categories: `MAINTENANCE` (expense), `VIOLATION_CHARGES` (income),
`MERCHANT_SUBSCRIPTIONS` (income), `MACHINE_PURCHASE` (expense).

### `payment_methods` + translations
`code` (`CASH`, `BANK_TRANSFER`, `INSTAPAY`, `WALLET`, `CHEQUE`, `CARD`), `is_active`.

### `suppliers`
`name`, `phone` NULL, `notes` NULL, `is_active`.

### `finance_transactions`
| Column | Type | Notes |
|---|---|---|
| reference_no | VARCHAR(30) UNIQUE | `EXP-2026-000512` / `INC-2026-000119` |
| kind | VARCHAR(10) | `EXPENSE` / `INCOME` |
| amount | NUMERIC(14,2) NOT NULL CHECK > 0 | EGP only |
| category_id | UUID FK **NOT NULL** | |
| transaction_date | DATE **NOT NULL** | |
| payment_method_id | UUID FK **NOT NULL** | |
| branch_id | UUID FK NULL | NULL = company-level |
| supplier_id | UUID FK NULL | optional |
| invoice_media_id | UUID FK media NULL | optional |
| notes | TEXT NULL | optional |
| source | VARCHAR(20) | `MANUAL`, `AUTO_MAINTENANCE`, `AUTO_VIOLATION`, `AUTO_SUBSCRIPTION` |
| source_ref_type / source_ref_id | VARCHAR(30) / UUID NULL | back-link to the origin record |
| is_voided | BOOLEAN DEFAULT false | |
| voided_by_user_id / voided_at / void_reason | | |

Index: `(transaction_date)`, `(category_id, transaction_date)`, `(branch_id, transaction_date)`,
`(kind, transaction_date)`, `source_ref_id`.

### `budgets`
`category_id` FK, `branch_id` FK NULL, `period_type` VARCHAR(10) (`MONTHLY`,`QUARTERLY`,`YEARLY`,`CUSTOM`),
`period_start` DATE, `period_end` DATE, `amount` NUMERIC(14,2),
`alert_threshold_percent` INT DEFAULT 80, `include_subcategories` BOOLEAN DEFAULT true, `is_active`.
UNIQUE(category_id, branch_id, period_start, period_end).

---

## I. Infrastructure tables

### `media`
`storage_key` TEXT, `url` TEXT, `mime_type`, `size_bytes` BIGINT, `width`/`height` INT NULL,
`purpose` VARCHAR(30) (`TRANSFER_PHOTO`,`SIGNATURE`,`INVOICE`,`AVATAR`), `uploaded_by_user_id`,
`checksum` VARCHAR(64).

### `notifications`
`user_id`, `template_code`, `title`, `body`, `data` JSONB, `read_at` NULL, `sent_at`, `channel`
(`PUSH`,`IN_APP`), `entity_type`/`entity_id` NULL.

### `notification_templates` + translations
`code`, `is_active`, `default_channel`.

### `audit_logs`
`user_id` NULL, `action` VARCHAR(60), `entity_type` VARCHAR(60), `entity_id` UUID NULL,
`before` JSONB NULL, `after` JSONB NULL, `ip_address` INET NULL, `user_agent` TEXT NULL,
`request_id` VARCHAR(64). Partitioned by month if volume grows.

### `idempotency_keys`
`key` VARCHAR(120) UNIQUE, `user_id`, `endpoint`, `request_hash`, `response_body` JSONB,
`status_code` INT, `expires_at`.

---

## Referential integrity summary

```
machines 1—1 batteries
machines 1—N transfer_items N—1 transfers
machines 1—N maintenance_orders
machines 1—1 decommissions
machines 1—1 machine_replacements (as old / as new)
merchants 1—N merchant_subscriptions
finance_categories 1—N finance_categories (self, unlimited)
finance_categories 1—N finance_transactions
users 1—N violations
```

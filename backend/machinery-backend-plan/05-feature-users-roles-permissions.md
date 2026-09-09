# 05 — Feature: Users, Roles & Permissions

## Goal

The Director creates and manages every account, assigns a role, scopes users to a branch, and can
grant or revoke individual permissions per user — especially finance access.

## Endpoints

### Users
| Method | Path | Permission |
|---|---|---|
| GET | `/users` | `users.read` |
| GET | `/users/:id` | `users.read` |
| POST | `/users` | `users.create` |
| PATCH | `/users/:id` | `users.update` |
| PATCH | `/users/:id/deactivate` | `users.deactivate` |
| PATCH | `/users/:id/activate` | `users.deactivate` |
| POST | `/users/:id/reset-password` | `users.update` |
| GET | `/users/:id/permissions` | `users.read` |
| PUT | `/users/:id/permissions` | `roles.manage` |
| GET | `/users/:id/custody` | `machines.read` |
| GET | `/users/:id/violations` | `violations.read` |

`GET /users` filters: `search` (name/phone), `roleId`, `branchId`, `isActive`, pagination.

### Roles
| Method | Path | Permission |
|---|---|---|
| GET | `/roles` | `users.read` |
| POST | `/roles` | `roles.manage` |
| PATCH | `/roles/:id` | `roles.manage` |
| PUT | `/roles/:id/permissions` | `roles.manage` |
| GET | `/permissions` | `roles.manage` |

`GET /permissions` returns them grouped, localized, ready to render as a checkbox tree in the app.

## DTOs

```ts
export class CreateUserDto {
  @IsString() @Length(3, 150) fullName: string;
  @IsPhoneNumber('EG') phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsUUID() roleId: string;
  @IsOptional() @IsUUID() branchId?: string;   // required if role is branch-scoped
  @IsString() @MinLength(8) password: string;
}

export class SetUserPermissionsDto {
  @IsArray() @IsUUID('4', { each: true }) allow: string[];
  @IsArray() @IsUUID('4', { each: true }) deny: string[];
}
```

## Business rules

1. `BRANCH_SUPERVISOR` and `REPRESENTATIVE` **must** have a `branchId`. Validate in the service.
2. A user cannot be deactivated while holding machines. Return `409 USER_HAS_CUSTODY` with the
   machine count. The Director must first move the custody to another user via a transfer.
3. A role marked `is_system` cannot be deleted; its permissions can still be edited.
4. Changing a user's role or overrides invalidates the Redis permission cache immediately.
5. A user cannot edit their own permissions or role, even as Director (prevents lockout). A second
   Director account is required — enforce that at least one active `DIRECTOR` always exists.
6. Deactivating a user revokes all their refresh tokens.

## `GET /users/:id/custody` response

Everything currently in this user's hands — the single most requested screen for supervisors:

```json
{
  "user": { "id": "…", "fullName": "…", "role": "REPRESENTATIVE" },
  "summary": { "totalMachines": 23, "withMerchants": 19, "inHand": 4, "openViolations": 2 },
  "machines": [
    { "id":"…","serial":"SN-00341","model":"…","status":"WITH_MERCHANT",
      "merchant": { "id":"…","shopName":"…" }, "heldSince":"2026-05-02T…" }
  ]
}
```

## Tests

- creating a representative without a branch → 400
- deactivating a user holding machines → 409
- a DENY override beats a role ALLOW
- permission cache invalidated on role change

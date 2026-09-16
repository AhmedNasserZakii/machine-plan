# 18 — Feature: Users, Roles & Permissions

Mobile counterpart: `mobile-app/lib/feature/users/` (6 screens). The Director's control panel, and
the feature where the web form factor beats the phone most decisively — a permission matrix is a
grid, and a grid needs a screen.

## Endpoints

| Method | Path | Screen |
|---|---|---|
| GET/POST | `users` | list / create |
| GET/PATCH | `users/{id}` | detail / edit |
| PATCH | `users/{id}/activate` · `users/{id}/deactivate` | status |
| GET/PUT | `users/{id}/permissions` | per-user overrides |
| POST | `users/{id}/reset-password` | reset |
| GET | `users/{id}/custody` | custody tab |
| GET | `users/{id}/violations` · `/summary` | violations tab (`15`) |
| GET/POST | `roles` | roles list / create |
| GET/PATCH | `roles/{id}` | role detail |
| PUT | `roles/{id}/permissions` | role matrix |
| GET | `permissions` | the grouped, localized catalogue |

## `/users` — list

Columns: full name (sticky) · phone (`<PhoneText>`) · role · branch · status · machines held ·
open violations · last login · created at.
Sortable: `fullName`, `phone`, `createdAt`, `lastLoginAt`.
Filters: search · roleId · branchId · isActive · `hasCustody`.

Actions: New user (`users.create`) · Export (`reports.export`).

## User form

Fields: full name · phone (the login identifier — validated, LTR, unique) · role · branch ·
warehouse (optional) · initial password with a generate button · "must change password on first
login" (default **on**, and it should stay on).

There is no self-service reset anywhere in the system (`09`), so the create flow must make the
initial credentials easy to hand over: show them once, with a copy button and a clear warning that
they will not be shown again.

Edit cannot change the phone number once set if the backend treats it as immutable — check the
contract and disable rather than letting the user try.

## `/users/[id]` — detail

Header: name · role chip · branch · status · last login.
Rail: contact, role, branch, warehouse, created by/at, quick actions.

Tabs:

| Tab | Source |
|---|---|
| profile | `users/{id}` |
| permissions | `users/{id}/permissions` — the override editor, below |
| custody | `users/{id}/custody` — machines currently held, each linking to the machine |
| violations | `users/{id}/violations` + `/summary` (`15`) |

Actions: Edit (`users.update`) · Reset password (`users.update`) · Activate / Deactivate
(`users.deactivate`).

**Deactivate** refuses with `USER_HAS_CUSTODY` when the user still holds machines. Show the custody
list and link to the transfer wizard so their machines can be handed over. `LAST_DIRECTOR` refuses
removing the final director — explain it rather than showing a generic failure.

## Per-user permission overrides

`GET users/{id}/permissions` returns three things: `rolePermissions`, `overrides`
(each with `effect: ALLOW | DENY`), and `effectivePermissions`. The editor must show all three,
because the whole point is understanding *why* a user has a permission.

Per row: the permission (localized label from `GET /permissions`), whether the role grants it, the
override state (inherit / allow / deny) as a tri-state, and the resulting effective value with the
reason ("granted by role", "allowed by override", "denied by override").

```
effective = (role ∪ overrides[ALLOW]) \ overrides[DENY]
```

DENY wins. Show that clearly — a DENY override on a role-granted permission is the confusing case
and it is exactly the one a Director will use.

`PUT users/{id}/permissions` takes `{ allow: string[], deny: string[] }` — the **full** override
lists, not a diff. Save the whole state.

`CANNOT_EDIT_OWN_PERMISSIONS`: the editor is read-only when viewing yourself, with the reason
stated up front rather than on a failed save.

The backend caches effective permissions for 15 minutes; tell the user the change may take a few
minutes to reach an active session instead of letting them think it failed.

## `/roles` and `/roles/[id]` — the permission matrix

Roles are permission bundles: `DIRECTOR`, `BRANCH_SUPERVISOR`, `REPRESENTATIVE`, `ACCOUNTANT`,
`VIEWER`, plus custom ones.

List: name · code · system badge · permission count · user count.

Detail is a **matrix**: permission groups (from `GET /permissions`, which returns the catalogue
grouped and localized) down the inline-start, checkboxes across. Features:

- Group-level check-all / uncheck-all with an indeterminate state.
- Search that filters rows and keeps groups with matches.
- A diff summary before saving ("+4 added, −1 removed") — this is a high-consequence save.
- System roles are read-only with a badge; `DIRECTOR` always holds everything.
- Changing a role's permissions affects every user with it: show the user count in the confirm
  dialog. "This will change permissions for 14 users" is the sentence that prevents the mistake.
- `PUT roles/{id}/permissions` sends the complete list.

Give the Director a **preview**: pick a role, see the sidebar and the action set a user with that
role would get. It turns an abstract checkbox grid into something verifiable, and it is the
cheapest way to prevent a locked-out-supervisor support call.

## Acceptance

- [ ] The override editor shows role-granted, override, and effective state with the reason.
- [ ] DENY visibly beats role-granted.
- [ ] `PUT` sends full lists, not diffs, for both users and roles.
- [ ] Editing your own permissions is blocked up front.
- [ ] Deactivate with custody lists the machines and offers the hand-over route.
- [ ] `LAST_DIRECTOR` is explained.
- [ ] Role save shows the affected user count.
- [ ] Permission labels come from `GET /permissions`, localized — never from a hardcoded map.

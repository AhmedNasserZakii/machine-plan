# 10 — Feature: Users, Roles & Permissions (Director only)

## Goal

The Director creates every account, assigns a role, scopes it to a branch, and — critically — grants
or revokes individual permissions per user. This is where "المدير هو اللي بيحدد مين يشوف الفلوس"
becomes a real screen.

## Screens

| Page | Route | Permission |
|---|---|---|
| `UsersListPage` | `/users` | `users.read` |
| `UserDetailPage` | `/users/:id` | `users.read` |
| `UserFormPage` | `/users/form` | `users.create` / `users.update` |
| `UserPermissionsPage` | `/users/:id/permissions` | `roles.manage` |
| `RolesListPage` | `/settings/roles` | `roles.manage` |
| `RolePermissionsPage` | `/settings/roles/:id` | `roles.manage` |

## Structure

```
features/users/
├── data/
│   ├── models/ (user_model.dart, role_model.dart, permission_model.dart,
│   │            permission_group_model.dart, user_custody_model.dart)
│   ├── datasources/users_remote_datasource.dart
│   └── repositories/users_repository.dart
└── presentation/
    ├── cubit/ (users_list_cubit.dart, user_detail_cubit.dart, user_form_cubit.dart,
    │           user_permissions_cubit.dart, roles_cubit.dart) + states
    ├── pages/ (users_list_page.dart, user_detail_page.dart, user_form_page.dart,
    │           user_permissions_page.dart, roles_list_page.dart, role_permissions_page.dart)
    └── widgets/
        ├── user_card.dart
        ├── user_avatar.dart
        ├── user_role_chip.dart
        ├── user_status_chip.dart
        ├── users_filter_sheet.dart
        ├── user_form_fields.dart
        ├── role_selector.dart
        ├── branch_selector.dart
        ├── user_custody_summary.dart
        ├── user_violations_summary.dart
        ├── user_activity_section.dart
        ├── permission_group_tile.dart
        ├── permission_checkbox_tile.dart
        ├── permission_override_badge.dart
        ├── permission_search_field.dart
        ├── role_card.dart
        ├── deactivate_user_dialog.dart
        └── reset_password_dialog.dart
```

## UserPermissionsPage — the important one

Shows every permission grouped by module. Each permission has **three visual states**:

| State | Meaning | Visual |
|---|---|---|
| inherited from role | comes with the role, not overridden | grey check, subtitle "من الدور" |
| explicitly allowed | override ALLOW | green check + "مسموح خصيصًا" badge |
| explicitly denied | override DENY | red cross + "ممنوع خصيصًا" badge |

Tapping cycles: `inherited → allow → deny → inherited`.

```
┌─────────────────────────────────────────┐
│ أحمد سالم — مشرف فرع                    │
│ فرع الإسكندرية                          │
├─────────────────────────────────────────┤
│ 🔍 دوّر على صلاحية                       │
├─────────────────────────────────────────┤
│ ▼ المالية                    ٢ معدّلة    │
│   ☑ عرض المالية      [مسموح خصيصًا] 🟢   │
│   ☑ إضافة معاملة     [مسموح خصيصًا] 🟢   │
│   ☐ إلغاء معاملة     من الدور            │
│   ☐ إدارة الأقسام    من الدور            │
├─────────────────────────────────────────┤
│ ▶ الماكينات                 من الدور     │
│ ▶ التسليمات                 من الدور     │
└─────────────────────────────────────────┘
        [حفظ التعديلات]
```

Groups collapse by default with a badge showing how many overrides they contain, so the Director can
see at a glance which modules are customised. `PermissionSearchField` filters across all groups.

Save sends `PUT /users/:id/permissions` with `{ allow: [...], deny: [...] }`. Show a confirmation
listing exactly what changed before sending — permission changes are consequential and should not be
a silent auto-save.

## UserFormPage

Fields: full name, phone, email (optional), role, branch (required and shown **only** when the
selected role is branch-scoped), initial password.

`BranchSelector` appears/disappears reactively based on `RoleSelector`. Do not show a disabled
branch field for a Director — remove it.

Note under the password field: "المستخدم هيتطلب منه يغير الباسورد أول مرة يدخل."

## UserDetailPage

Sections, each its own widget:
- header: name, role, branch, active status
- `UserCustodySummary` — machines held now, with a link to the full list
- `UserViolationsSummary` — counts by severity, charged total, trend, link to the register
- `UserActivitySection` — recent transfers and confirmations
- actions: edit, manage permissions, reset password, deactivate

## Deactivation

`DeactivateUserDialog` calls the API; on `409 USER_HAS_CUSTODY` it shows the machine count and a
button "شوف الماكينات" that routes to the custody list. The dialog does **not** offer a force option —
custody must be transferred properly, with signatures.

## Rules

1. This whole feature is gated on `users.read`; the tab is invisible without it.
2. Editing your own permissions is blocked client-side too, with an explanatory message.
3. This feature is **online-only** — user management is not queued offline. Show a clear
   "محتاج اتصال بالإنترنت" state.
4. Reset password never displays the new password in a snackbar that could be screenshotted in a
   log; show it once in a copyable dialog with a warning.

# 21 — Permission → UI Matrix

## The principle

**The UI is built from the permission list, not from the role name.** There is not a single
`if (user.role == 'DIRECTOR')` in this app. The Director can grant one supervisor finance access
without a code change, and that only works if every gate reads permissions.

## PermissionService

```dart
// core/permissions/permission_service.dart
class PermissionService {
  final AuthCubit _auth;
  PermissionService(this._auth);

  List<String> get _perms => switch (_auth.state) {
    Authenticated(:final permissions) => permissions,
    _ => const [],
  };

  bool has(String p) => _perms.contains(p);
  bool hasAny(List<String> p) => p.any(has);
  bool hasAll(List<String> p) => p.every(has);

  /// True when the user can see beyond their own branch.
  bool canSeeAllBranches(String resource) => has('$resource.read.all');
}
```

Permission constants are generated from the backend catalogue so a typo is a compile error:

```dart
// core/permissions/permission_keys.dart
abstract final class P {
  static const machinesRead        = 'machines.read';
  static const machinesReadAll     = 'machines.read.all';
  static const machinesCreate      = 'machines.create';
  static const machinesDecommission = 'machines.decommission';
  static const transfersCreate     = 'transfers.create';
  static const transfersConfirm    = 'transfers.confirm';
  static const financeRead         = 'finance.read';
  static const financeCreate       = 'finance.create';
  static const financeVoid         = 'finance.void';
  // … full catalogue
}
```

## PermissionGate widget

```dart
// core/widgets/permission_gate.dart
class PermissionGate extends StatelessWidget {
  final String? permission;
  final List<String>? anyOf;
  final Widget child;
  final Widget? fallback;

  const PermissionGate({super.key, this.permission, this.anyOf,
                        required this.child, this.fallback});

  @override
  Widget build(BuildContext context) {
    final svc = sl<PermissionService>();
    final allowed = permission != null ? svc.has(permission!) : svc.hasAny(anyOf ?? const []);
    return allowed ? child : (fallback ?? const SizedBox.shrink());
  }
}
```

Usage:

```dart
PermissionGate(
  permission: P.financeCreate,
  child: const AddExpenseFab(),
)
```

## The three levels of gating

| Level | Mechanism | Purpose |
|---|---|---|
| **Navigation** | tabs and menu entries built from permissions | the user never sees a door they cannot open |
| **Widget** | `PermissionGate` around actions | no disabled buttons teasing features |
| **Route** | `permissionGuard` in the router | backstop against deep links and stale state |

**Prefer hiding over disabling.** A disabled "تسجيل مصروف" button tells a representative that a
feature exists and he is not trusted with it — which invites questions the supervisor has to field.
Remove it.

Exception: an action disabled for **state** reasons (not permission) should stay visible with the
reason — "لازم الماكينة تكون في المخزن الرئيسي". That is information, not a wall.

## Bottom navigation

| Tab | Condition |
|---|---|
| الرئيسية | always |
| الماكينات | `machines.read` |
| التسليمات | `transfers.read` |
| التجار | `merchants.read` |
| المالية | `finance.read` |
| المزيد | always |

Cap at 5 visible; overflow into "المزيد".

## Full matrix

### Machines
| Element | Permission |
|---|---|
| Machines tab & list | `machines.read` |
| See other branches | `machines.read.all` |
| Add / bulk import | `machines.create` / `machines.import` |
| Edit | `machines.update` |
| Decommission action | `machines.decommission` |
| Cost summary card | `maintenance.read` |
| Decommission candidates | `machines.read.all` |

### Transfers
| Element | Permission |
|---|---|
| Transfers tab | `transfers.read` |
| Create transfer FAB | `transfers.create` |
| Confirm / sign | `transfers.confirm` + be the designated receiver |
| Reject | `transfers.reject` + be the receiver |
| Cancel | `transfers.cancel` + be the sender + within the window |
| All-branch history | `transfers.read.all` |

### Merchants
| Element | Permission |
|---|---|
| Merchants tab | `merchants.read` |
| Add merchant | `merchants.create` |
| Edit | `merchants.update` |
| Deactivate | `merchants.delete` |
| Collect subscription | `finance.create` |
| See others' merchants | `merchants.read.all` |

### Maintenance
| Element | Permission |
|---|---|
| Maintenance section | `maintenance.read` |
| Open order | `maintenance.create` |
| Close + set cost | `maintenance.close` + `maintenance.set_cost` |
| Replacement | `machines.create` |

### Violations
| Element | Permission |
|---|---|
| Violations list | `violations.read` |
| **My own violations** | **always, for everyone** |
| Others' violations | `violations.read.all` |
| Create manual | `violations.create` |
| Charge | `violations.resolve` |
| Waive | `violations.waive` |

### Finance — the gated module
| Element | Permission |
|---|---|
| Finance tab, all screens | `finance.read` |
| Other branches' finance | `finance.read.all` |
| Add transaction FABs | `finance.create` |
| Edit transaction | `finance.update` |
| Void | `finance.void` |
| Manage categories | `finance.categories.manage` |
| Manage budgets | `finance.budgets.manage` |
| Finance card on dashboard | `finance.read` |
| Finance reports | `reports.finance` |

### Users & settings
| Element | Permission |
|---|---|
| Users section | `users.read` |
| Create / edit | `users.create` / `users.update` |
| Deactivate | `users.deactivate` |
| Manage roles & overrides | `roles.manage` |
| Branch management | `branches.manage` |
| Audit log | `audit.read` |

## Reactivity

Permissions can change while the app is open (the Director grants finance access). The app must:
1. refresh permissions on every app resume via `/auth/me`,
2. rebuild navigation and gated widgets when the list changes — `PermissionGate` listens to
   `AuthCubit`, so this is automatic if permissions live in `AuthState`,
3. if the user is on a screen they just lost access to, pop to home with a brief explanation.

## Offline

Permissions are cached locally and used offline. They are refreshed on the next successful
`/auth/me`. A stale permission list offline is acceptable — **the server enforces the real
boundary on every request**. Client-side gating is UX, not security. Never rely on it alone.

# 06 — Dependency Injection & Routing

> Match the project. If it uses Riverpod providers or Provider, translate the registrations. If it
> uses AutoRoute or Navigator 1.0, translate the routes. The **guards** and **route list** are the
> deliverable.

## DI (GetIt example)

```dart
// core/di/injector.dart
final sl = GetIt.instance;

Future<void> configureDependencies() async {
  // --- core singletons ---
  sl.registerSingleton<AppConfig>(AppConfig.fromEnvironment());
  sl.registerSingleton<SecureStorage>(SecureStorage());
  sl.registerSingleton<LocalDatabase>(await LocalDatabase.open());
  sl.registerSingleton<ConnectivityService>(ConnectivityService()..start());
  sl.registerSingleton<Dio>(buildDio(sl()));
  sl.registerSingleton<PermissionService>(PermissionService(sl()));
  sl.registerSingleton<SyncService>(SyncService(sl(), sl(), sl()));

  // --- datasources (lazy) ---
  sl.registerLazySingleton(() => MachinesRemoteDatasource(sl()));
  sl.registerLazySingleton(() => MachinesLocalDatasource(sl()));

  // --- repositories (lazy) ---
  sl.registerLazySingleton(() => MachinesRepository(sl(), sl(), sl()));

  // --- cubits (factory — new instance per screen) ---
  sl.registerFactory(() => MachinesListCubit(sl()));
  sl.registerFactoryParam<MachineDetailCubit, String, void>((id, _) => MachineDetailCubit(sl(), id));
}
```

**Lifetime rules**
- `registerSingleton` — things with state that must be shared: config, DB, connectivity, sync, auth.
- `registerLazySingleton` — repositories and datasources (stateless, expensive to build).
- `registerFactory` — cubits/blocs, always. A screen must never inherit another screen's state.

`AuthCubit` is the one exception: a singleton, because session state is global.

## Routing (GoRouter example)

```dart
// core/routing/route_names.dart
abstract final class Routes {
  static const splash    = '/';
  static const login     = '/login';
  static const changePassword = '/change-password';
  static const home      = '/home';

  static const machines        = '/machines';
  static const machineDetail   = '/machines/:id';
  static const machineForm     = '/machines/form';
  static const machineScan     = '/machines/scan';

  static const transfers       = '/transfers';
  static const transferDetail  = '/transfers/:id';
  static const transferCreate  = '/transfers/create';
  static const transferConfirm = '/transfers/:id/confirm';

  static const merchants       = '/merchants';
  static const merchantDetail  = '/merchants/:id';
  static const merchantForm    = '/merchants/form';

  static const maintenance       = '/maintenance';
  static const maintenanceDetail = '/maintenance/:id';
  static const maintenanceForm   = '/maintenance/form';

  static const violations      = '/violations';
  static const violationDetail = '/violations/:id';

  static const finance          = '/finance';
  static const financeTransactions = '/finance/transactions';
  static const financeForm      = '/finance/transactions/form';
  static const financeCategories = '/finance/categories';
  static const financeBudgets   = '/finance/budgets';

  static const reports      = '/reports';
  static const reportDetail = '/reports/:key';

  static const notifications = '/notifications';

  static const users      = '/users';
  static const userDetail = '/users/:id';
  static const userForm   = '/users/form';
  static const userPermissions = '/users/:id/permissions';

  static const settings = '/settings';
  static const syncQueue = '/settings/sync';
}
```

## Guards

```dart
// core/routing/route_guards.dart
String? authGuard(BuildContext context, GoRouterState state) {
  final auth = sl<AuthCubit>().state;
  if (auth is! Authenticated) return Routes.login;
  if (auth.user.mustChangePassword && state.uri.path != Routes.changePassword) {
    return Routes.changePassword;
  }
  return null;
}

String? permissionGuard(String permission) => …;   // redirect to home + snackbar if missing
```

Every route that needs a permission declares it in its `redirect`. **The guard is a backstop, not
the primary mechanism** — the real defence is that the user never sees a link to a screen they
cannot use (see `21`).

## Shell / bottom navigation

The bottom bar is **built from permissions**, so different users see different tabs:

| Tab | Shown when |
|---|---|
| الرئيسية (Home) | always |
| الماكينات (Machines) | `machines.read` |
| التسليمات (Transfers) | `transfers.read` |
| التجار (Merchants) | `merchants.read` |
| المالية (Finance) | `finance.read` |
| المزيد (More) | always — reports, users, settings, notifications |

A representative sees 4 tabs; the Director sees 6. Cap the visible bar at 5 items and push the rest
into "More", otherwise the bar breaks on small screens.

## Deep links

Push notifications carry `deepLink: "machinery://transfers/<id>"`. Register the scheme on both
platforms and route through GoRouter. Handle three cases:
1. app in foreground → navigate directly,
2. app in background → navigate on resume,
3. app terminated → store the pending link, consume it after splash + auth.

Case 3 is the one that gets forgotten and is the most common in the field.

## Navigation rules

1. **Named routes only.** No `MaterialPageRoute` with an inline builder in feature code.
2. Cubits are provided at the route level via `BlocProvider(create: (_) => sl<XCubit>())`, so the
   cubit's lifetime matches the screen's.
3. Return values from screens (e.g. a picked merchant) come back through `context.pop(result)`, not
   through a shared singleton.
4. After a successful create/edit, pop **and** signal the list to refresh — do not rely on the list
   rebuilding by itself.

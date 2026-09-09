# 02 — Project Structure

> Mirror the existing project if one exists. This is the target shape for a greenfield build.

```
lib/
├── main.dart
├── app.dart                          # MaterialApp, theme, locale, router wiring
├── bootstrap.dart                    # DI init, local DB open, Firebase, error zone
│
├── core/
│   ├── config/
│   │   ├── app_config.dart           # base URL, flavors, timeouts
│   │   └── constants.dart
│   ├── di/
│   │   └── injector.dart             # GetIt registrations (or the project's DI)
│   ├── network/
│   │   ├── api_client.dart           # Dio instance + interceptors
│   │   ├── interceptors/
│   │   │   ├── auth_interceptor.dart
│   │   │   ├── locale_interceptor.dart
│   │   │   ├── idempotency_interceptor.dart
│   │   │   ├── retry_interceptor.dart
│   │   │   └── logging_interceptor.dart
│   │   ├── api_endpoints.dart
│   │   ├── api_result.dart           # Success / Failure wrapper
│   │   └── api_exception.dart        # maps backend error codes
│   ├── storage/
│   │   ├── secure_storage.dart       # tokens, biometric flag
│   │   ├── local_database.dart       # drift/isar setup
│   │   └── daos/                     # one DAO per cached entity
│   ├── sync/
│   │   ├── sync_service.dart
│   │   ├── sync_queue_dao.dart
│   │   └── connectivity_service.dart
│   ├── permissions/
│   │   ├── permission_keys.dart      # generated constants, mirrors backend catalogue
│   │   └── permission_service.dart   # has(), hasAny(), hasAll()
│   ├── theme/
│   │   ├── app_theme.dart
│   │   ├── app_colors.dart
│   │   ├── app_text_styles.dart
│   │   ├── app_spacing.dart
│   │   └── app_radius.dart
│   ├── localization/
│   │   ├── l10n/ (app_ar.arb, app_en.arb)
│   │   └── locale_service.dart
│   ├── routing/
│   │   ├── app_router.dart
│   │   ├── route_names.dart
│   │   └── route_guards.dart
│   ├── errors/
│   │   ├── failure.dart
│   │   └── error_mapper.dart         # error code → localized message
│   ├── extensions/
│   ├── utils/
│   │   ├── formatters.dart           # currency (EGP), dates, Arabic numerals
│   │   ├── validators.dart
│   │   └── image_compressor.dart
│   └── widgets/                      # shared, app-wide widgets — one per file
│       ├── app_button.dart
│       ├── app_text_field.dart
│       ├── app_dropdown.dart
│       ├── app_date_picker.dart
│       ├── app_search_field.dart
│       ├── app_empty_state.dart
│       ├── app_error_view.dart
│       ├── app_loading_indicator.dart
│       ├── app_confirm_dialog.dart
│       ├── app_bottom_sheet.dart
│       ├── status_chip.dart
│       ├── offline_banner.dart
│       ├── sync_status_badge.dart
│       ├── permission_gate.dart      # renders children only if permission held
│       └── paginated_list_view.dart
│
└── features/
    ├── auth/
    ├── home/
    ├── machines/
    ├── transfers/
    ├── merchants/
    ├── maintenance/
    ├── violations/
    ├── finance/
    ├── reports/
    ├── notifications/
    ├── users/
    └── settings/
```

## Feature internal structure

Every feature looks identical:

```
features/machines/
├── data/
│   ├── models/
│   │   ├── machine_model.dart
│   │   ├── machine_detail_model.dart
│   │   └── machine_timeline_event_model.dart
│   ├── datasources/
│   │   ├── machines_remote_datasource.dart
│   │   └── machines_local_datasource.dart
│   └── repositories/
│       └── machines_repository.dart      # decides local vs remote, handles offline
├── presentation/
│   ├── cubit/                            # or bloc/ or controller/ — match the project
│   │   ├── machines_list_cubit.dart
│   │   ├── machines_list_state.dart
│   │   ├── machine_detail_cubit.dart
│   │   └── machine_detail_state.dart
│   ├── pages/
│   │   ├── machines_list_page.dart
│   │   ├── machine_detail_page.dart
│   │   └── machine_form_page.dart
│   └── widgets/                          ← EVERY widget lives here, one per file
│       ├── machine_card.dart
│       ├── machine_status_chip.dart
│       ├── machine_filter_sheet.dart
│       ├── machine_search_bar.dart
│       ├── machine_info_section.dart
│       ├── machine_battery_section.dart
│       ├── machine_warranty_card.dart
│       ├── machine_cost_summary_card.dart
│       ├── machine_timeline_list.dart
│       ├── machine_timeline_tile.dart
│       ├── machine_holder_card.dart
│       └── machines_empty_state.dart
```

Note how many widget files one screen produces. That is intentional and correct — see `01`.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Files | `snake_case` | `machine_detail_page.dart` |
| Classes | `PascalCase` + role suffix | `MachineDetailPage`, `MachinesCubit` |
| Pages | `*Page` | `TransfersListPage` |
| Widgets | descriptive noun, no suffix | `MachineCard` |
| Cubits | `*Cubit` + `*State` | `TransfersCubit` / `TransfersState` |
| Models | `*Model` | `MachineModel` |
| Repositories | `*Repository` | `MachinesRepository` |
| Datasources | `*RemoteDatasource` / `*LocalDatasource` | |
| l10n keys | `camelCase`, feature-prefixed | `machinesEmptyStateTitle` |
| Route names | `snake_case` paths | `/machines/:id` |

## Layer responsibilities

| Layer | Does | Never does |
|---|---|---|
| **Page** | layout, wiring cubit to widgets | business logic, direct API calls |
| **Widget** | render one thing from its props | fetch data, own business state |
| **Cubit** | UI state, calls repository | HTTP, SQL, `BuildContext` |
| **Repository** | decides local vs remote, maps errors, queues offline ops | UI concerns |
| **Datasource** | one job — HTTP, or local DB | branching between the two |

The repository is where offline-first lives. A cubit never knows whether data came from the network
or the local database.

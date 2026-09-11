import 'package:device_preview/device_preview.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:hydrated_bloc/hydrated_bloc.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:machinery/core/constants/app_localization.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/network_services/idempotency_interceptor.dart';
import 'package:machinery/core/services/locale_service.dart';
import 'package:machinery/core/services/observability/crash_reporter.dart';
import 'package:machinery/core/services/sync/sync_coordinator.dart';
import 'package:machinery/my_app.dart';
import 'package:path_provider/path_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  HydratedBloc.storage = await HydratedStorage.build(
    storageDirectory: HydratedStorageDirectory(
      (await getApplicationDocumentsDirectory()).path,
    ),
  );

  await LocalStorage.init();
  // Opened before the locator so every DAO it hands out has a real,
  // already-open `Database` — no service in this app awaits its own
  // dependencies lazily.
  final AppDatabase appDatabase = await AppDatabase.open();
  setupServiceLocator(appDatabase);
  await _ensureDeviceId();
  _installCrashHandlers();

  final SyncCoordinator syncCoordinator = getIt<SyncCoordinator>();
  syncCoordinator.start();
  getIt<LocaleService>().registerCacheInvalidator(
    syncCoordinator.invalidateForLocaleChange,
  );

  await EasyLocalization.ensureInitialized();
  await Future.wait<void>(<Future<void>>[
    initializeDateFormatting('ar'),
    initializeDateFormatting('en'),
  ]);

  runApp(
    EasyLocalization(
      supportedLocales: LocaleService.supportedLocales,
      path: AppLocalizations.translationsPath,
      fallbackLocale: AppLocalizations.arabicLocale,
      startLocale: getIt<LocaleService>().resolveStartLocale(),
      saveLocale: true,
      child: DevicePreview(
        enabled: kDebugMode,
        builder: (context) => const MyApp(),
      ),
    ),
  );
}

void _installCrashHandlers() {
  final CrashReporter reporter = getIt<CrashReporter>();
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    reporter.recordFlutterError(details);
  };
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    reporter.recordError(error, stack, fatal: true);
    return true;
  };
}

/// A stable per-install id. Login sends it, and it becomes part of the
/// signature evidence on every hand-off.
Future<void> _ensureDeviceId() async {
  if (LocalStorage.getDeviceId().isNotEmpty) {
    return;
  }
  await LocalStorage.setDeviceId(generateUuidV4());
}

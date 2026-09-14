import 'package:device_preview/device_preview.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/network_services/unauthorized_session_handler.dart';
import 'package:machinery/core/network_services/upgrade_required_handler.dart';
import 'package:machinery/core/services/observability/app_analytics.dart';
import 'package:machinery/core/services/push/push_notification_service.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/upgrade_required_screen.dart';
import 'package:machinery/core/theme/styles/app_theme.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notification_badge/notification_badge_cubit.dart';
import 'package:machinery/feature/notifications/presentation/helpers/notification_deep_link_router.dart';
import 'package:machinery/feature/splash/presentation/pages/splash_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  final AuthCubit _authCubit = getIt<AuthCubit>();
  final NotificationBadgeCubit _badgeCubit = getIt<NotificationBadgeCubit>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    UnauthorizedSessionHandler.register(_onSessionExpired);
    UpgradeRequiredHandler.register(_onUpgradeRequired);
    getIt<PushNotificationService>().onNotificationOpened = () {
      final BuildContext? ctx = navigatorKey.currentContext;
      if (ctx == null || !ctx.mounted) {
        return;
      }
      NotificationDeepLinkRouter.consumePendingDeepLink(ctx);
    };
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    // Permissions can change while the app is backgrounded — the Director
    // grants finance access and the bottom bar has to grow to match.
    if (state == AppLifecycleState.resumed) {
      _authCubit.refreshProfile();
      _badgeCubit.refresh();
    }
  }

  /// A session that cannot be refreshed gets a blocking dialog, never a
  /// snackbar. The sync queue deliberately survives this.
  Future<void> _onSessionExpired(String message) async {
    final BuildContext? context = navigatorKey.currentContext;
    if (context == null || !context.mounted) {
      return;
    }

    await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.sessionExpired.tr(),
      description: message.trim().isNotEmpty
          ? message
          : LocaleKeys.sessionExpiredMessage.tr(),
      confirmLabel: LocaleKeys.login.tr(),
      cancelLabel: LocaleKeys.close.tr(),
    );

    if (context.mounted) {
      AppRoute.goToLoginScreen(context: context);
    }
  }

  Future<void> _onUpgradeRequired({
    required String message,
    String? minVersion,
  }) async {
    getIt<AppAnalytics>().track(
      AnalyticsEvents.upgradeRequiredShown,
      properties: <String, Object?>{
        'min_version': ?minVersion,
      },
    );
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;
    await navigator.pushAndRemoveUntil<void>(
      MaterialPageRoute<void>(
        builder: (_) => UpgradeRequiredScreen(
          message: message,
          minVersion: minVersion,
        ),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: <BlocProvider<dynamic>>[
        BlocProvider<AuthCubit>.value(value: _authCubit),
        BlocProvider<NotificationBadgeCubit>.value(value: _badgeCubit),
      ],
      child: MaterialApp(
        // `.tr()` resolves at build time and does not register a dependency on
        // the locale, and a pushed route caches its page widget — so without
        // this key a language switch only repaints whatever happens to rebuild
        // for other reasons, leaving the rest of the screen in the old
        // language. Re-keying rebuilds the navigator in the new locale, which
        // sends the user back through splash to where they already were.
        key: ValueKey<String>(context.locale.languageCode),
        title: LocaleKeys.appName.tr(),
        navigatorKey: navigatorKey,
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        builder: DevicePreview.appBuilder,
        debugShowCheckedModeBanner: false,
        theme: AppThemes.lightTheme,
        // Splash resolves the session and routes from there, including the
        // offline path that falls back to the cached profile.
        home: const SplashScreen(),
      ),
    );
  }
}

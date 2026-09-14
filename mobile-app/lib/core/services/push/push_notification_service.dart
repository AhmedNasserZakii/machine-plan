import 'dart:async';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/notifications/domain/params/register_device_params.dart';
import 'package:machinery/feature/notifications/domain/repos/notifications_repo.dart';

/// Channel id shared with the AndroidManifest / FCM default channel.
const String kMachineryPushChannelId = 'machinery_notifications';

/// Top-level entry for a background isolate. No-op until Firebase platform
/// config (`google-services.json` / `GoogleService-Info.plist`) is added.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase not connected yet — ignore background pushes.
  }
}

/// Owns FCM + local banners.
///
/// **Firebase is intentionally optional for now.** Until platform config is
/// added, [isFirebaseReady] stays false: no FCM listeners, no token fetch.
/// Device rows still register with the backend (`POST /devices`) without a
/// push token so logout cleanup and future token attach keep working.
///
/// List, preferences, badge, and deep-link restore do not depend on FCM.
class PushNotificationService {
  PushNotificationService();

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  FirebaseMessaging? _messaging;
  StreamSubscription<String>? _tokenRefreshSub;
  bool _firebaseReady = false;
  bool _initialized = false;
  VoidCallback? onNotificationOpened;

  bool get isFirebaseReady => _firebaseReady;

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }
    _initialized = true;

    // Local banners are useful once FCM is connected; set them up either way
    // so permission / channel plumbing is ready when config lands.
    await _setupLocalNotifications();

    try {
      await Firebase.initializeApp();
      _messaging = FirebaseMessaging.instance;
      _firebaseReady = true;
    } catch (error, stackTrace) {
      printDebug(
        message:
            'PushNotificationService: Firebase not connected yet — '
            'in-app notifications still work; live push skipped: $error',
        stackTrace: stackTrace,
      );
      _firebaseReady = false;
      _messaging = null;
      return;
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_onMessageOpened);

    final RemoteMessage? initial = await _messaging!.getInitialMessage();
    if (initial != null) {
      await _handleOpenPayload(initial.data);
    }
  }

  Future<void> _setupLocalNotifications() async {
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings();

    await _local.initialize(
      settings: const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final String? payload = response.payload;
        if (payload != null && payload.isNotEmpty) {
          unawaited(_storeDeepLink(payload));
          onNotificationOpened?.call();
        }
      },
    );

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      kMachineryPushChannelId,
      'Machinery',
      description: 'Operational alerts',
      importance: Importance.high,
    );

    await _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);
  }

  /// Contextual ask — never cold-launch. Shows an explanation dialog first.
  ///
  /// Without Firebase this still records that we asked (so we do not nag),
  /// and on Android can request the OS notification permission for later FCM.
  Future<bool> maybeRequestPermissionAfterFirstUse(BuildContext context) async {
    if (LocalStorage.getPushPermissionPrompted()) {
      return false;
    }

    if (!context.mounted) {
      return false;
    }

    final bool proceed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.notificationsPermissionTitle.tr(),
      description: LocaleKeys.notificationsPermissionBody.tr(),
      confirmLabel: LocaleKeys.notificationsPermissionAllow.tr(),
      cancelLabel: LocaleKeys.notificationsPermissionNotNow.tr(),
      icon: Icons.notifications_active_outlined,
    );

    await LocalStorage.setPushPermissionPrompted(value: true);

    if (!proceed || !context.mounted) {
      return false;
    }

    return requestPermissionWithExplanation(context);
  }

  Future<bool> requestPermissionWithExplanation(BuildContext context) async {
    if (Platform.isIOS) {
      final FirebaseMessaging? messaging = _messaging;
      if (messaging == null) {
        // iOS push permission goes through APNs/FCM — wait until Firebase is wired.
        return false;
      }
      final NotificationSettings settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      return settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
    }

    if (Platform.isAndroid) {
      final AndroidFlutterLocalNotificationsPlugin? android = _local
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      final bool? granted = await android?.requestNotificationsPermission();
      return granted ?? true;
    }

    return false;
  }

  /// Registers this install with the backend. Sends an FCM token only when
  /// Firebase is connected; otherwise registers the device id alone.
  Future<void> registerTokenWithBackend(NotificationsRepo repo) async {
    final String deviceId = LocalStorage.getDeviceId();
    if (deviceId.isEmpty) {
      return;
    }

    String? pushToken;
    final FirebaseMessaging? messaging = _messaging;
    if (_firebaseReady && messaging != null) {
      try {
        pushToken = await messaging.getToken();
        await _tokenRefreshSub?.cancel();
        _tokenRefreshSub = messaging.onTokenRefresh.listen((String token) {
          unawaited(
            _register(
              repo,
              deviceId: deviceId,
              pushToken: token,
            ),
          );
        });
      } catch (error, stackTrace) {
        printDebug(
          message: 'PushNotificationService.getToken failed: $error',
          stackTrace: stackTrace,
        );
      }
    }

    await _register(repo, deviceId: deviceId, pushToken: pushToken);
  }

  Future<void> _register(
    NotificationsRepo repo, {
    required String deviceId,
    String? pushToken,
  }) async {
    final DevicePlatform platform = Platform.isIOS
        ? DevicePlatform.ios
        : Platform.isAndroid
        ? DevicePlatform.android
        : DevicePlatform.web;

    await repo.registerDevice(
      params: RegisterDeviceParams(
        deviceId: deviceId,
        pushToken: pushToken,
        deviceModel: await _deviceModel(),
        platform: platform,
      ),
    );
  }

  /// Must run before session clear so the DELETE still carries a bearer token.
  Future<void> unregisterDevice(NotificationsRepo repo) async {
    final String deviceId = LocalStorage.getDeviceId();
    if (deviceId.isEmpty) {
      return;
    }

    await repo.unregisterDevice(deviceId: deviceId);

    final FirebaseMessaging? messaging = _messaging;
    if (_firebaseReady && messaging != null) {
      try {
        await messaging.deleteToken();
      } catch (_) {
        // Token delete is best-effort on logout.
      }
    }
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final RemoteNotification? notification = message.notification;
    final String title =
        notification?.title ?? message.data['title']?.toString() ?? '';
    final String body =
        notification?.body ?? message.data['body']?.toString() ?? '';
    final String? deepLink = _deepLinkFrom(message.data);

    if (title.isEmpty && body.isEmpty) {
      return;
    }

    await _local.show(
      id: message.hashCode,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          kMachineryPushChannelId,
          'Machinery',
          channelDescription: 'Operational alerts',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: deepLink,
    );
  }

  Future<void> _onMessageOpened(RemoteMessage message) async {
    await _handleOpenPayload(message.data);
  }

  Future<void> _handleOpenPayload(Map<String, dynamic> data) async {
    final String? deepLink = _deepLinkFrom(data);
    if (deepLink == null || deepLink.isEmpty) {
      // DIGEST and similar: land on the notifications list.
      await _storeDeepLink('machinery://notifications');
    } else {
      await _storeDeepLink(deepLink);
    }
    onNotificationOpened?.call();
  }

  Future<void> _storeDeepLink(String link) async {
    await LocalStorage.setPendingDeepLink(link);
  }

  String? _deepLinkFrom(Map<String, dynamic> data) {
    final dynamic raw = data['deepLink'] ?? data['deeplink'];
    if (raw == null) {
      return null;
    }
    final String link = raw.toString().trim();
    return link.isEmpty ? null : link;
  }

  Future<String?> _deviceModel() async {
    try {
      if (Platform.isAndroid) {
        final AndroidDeviceInfo info = await _deviceInfo.androidInfo;
        return '${info.manufacturer} ${info.model}'.trim();
      }
      if (Platform.isIOS) {
        final IosDeviceInfo info = await _deviceInfo.iosInfo;
        return info.modelName;
      }
    } catch (_) {
      // Model is optional on the wire.
    }
    return null;
  }
}

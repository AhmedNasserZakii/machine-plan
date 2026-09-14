import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:machinery/core/local_storage/local_storage_constant_keys.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Facade over `SharedPreferences` and `FlutterSecureStorage`.
///
/// Tokens live in secure storage only — never in preferences.
abstract class LocalStorage {
  static SharedPreferences? local;
  static FlutterSecureStorage? flutterSecureStorage;

  static Future<void> init() async {
    local = await SharedPreferences.getInstance();
    // `resetOnError: true` (package default) permanently erases every token
    // whenever Android KeyStore throws a transient decrypt error — which is
    // exactly how a cold start ends on the login screen with a "fresh" install
    // look. Keep the tokens; a later 401 + failed refresh is what clears them.
    flutterSecureStorage = const FlutterSecureStorage(
      aOptions: AndroidOptions(resetOnError: false),
    );
  }

  // ── Tokens ───────────────────────────────────────────────────────────────

  static Future<void> setAccessToken(String value) async {
    await flutterSecureStorage?.write(
      key: StorageKeys.accessToken,
      value: value,
    );
  }

  static Future<String> getAccessToken() async {
    return await flutterSecureStorage?.read(key: StorageKeys.accessToken) ?? '';
  }

  static Future<void> setRefreshToken(String value) async {
    await flutterSecureStorage?.write(
      key: StorageKeys.refreshToken,
      value: value,
    );
  }

  static Future<String> getRefreshToken() async {
    return await flutterSecureStorage?.read(key: StorageKeys.refreshToken) ??
        '';
  }

  static Future<void> deleteTokens() async {
    await flutterSecureStorage?.delete(key: StorageKeys.accessToken);
    await flutterSecureStorage?.delete(key: StorageKeys.refreshToken);
  }

  // ── Locale ───────────────────────────────────────────────────────────────

  static Future<void> setLocaleLanguage(String locale) async {
    await local?.setString(StorageKeys.localeLanguage, locale);
  }

  static String getLocaleLanguage() {
    final String? saved = local?.getString(StorageKeys.localeLanguage);
    if (saved == null || saved.trim().isEmpty) {
      return 'ar';
    }
    return saved.split('_').first;
  }

  // ── Device identity ──────────────────────────────────────────────────────

  static Future<void> setDeviceId(String value) async {
    await local?.setString(StorageKeys.deviceId, value);
  }

  static String getDeviceId() {
    return local?.getString(StorageKeys.deviceId) ?? '';
  }

  // ── Cached session ───────────────────────────────────────────────────────
  //
  // The user and permission list are cached so a representative with no signal
  // can still open the app and see a correctly gated UI.

  static Future<void> setCachedAuthUser(Map<String, dynamic> user) async {
    await local?.setString(StorageKeys.cachedAuthUser, json.encode(user));
  }

  static Map<String, dynamic>? getCachedAuthUser() {
    final String? raw = local?.getString(StorageKeys.cachedAuthUser);
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    try {
      final dynamic decoded = json.decode(raw);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Unreadable cache is treated as no cache.
    }
    deleteCachedAuthUser();
    return null;
  }

  static void deleteCachedAuthUser() {
    local?.remove(StorageKeys.cachedAuthUser);
  }

  static Future<void> setCachedPermissions(List<String> permissions) async {
    await local?.setStringList(StorageKeys.cachedPermissions, permissions);
  }

  static List<String> getCachedPermissions() {
    return local?.getStringList(StorageKeys.cachedPermissions) ?? <String>[];
  }

  static void deleteCachedPermissions() {
    local?.remove(StorageKeys.cachedPermissions);
  }

  // ── Biometric login ──────────────────────────────────────────────────────

  static Future<void> setIsBiometricLoginEnabled({required bool value}) async {
    await local?.setBool(StorageKeys.isBiometricLoginEnabled, value);
  }

  static bool getIsBiometricLoginEnabled() {
    return local?.getBool(StorageKeys.isBiometricLoginEnabled) ?? false;
  }

  // ── Sync ─────────────────────────────────────────────────────────────────

  static Future<void> setLastSyncedAt(String isoTimestamp) async {
    await local?.setString(StorageKeys.lastSyncedAt, isoTimestamp);
  }

  static String getLastSyncedAt() {
    return local?.getString(StorageKeys.lastSyncedAt) ?? '';
  }

  static Future<void> setSchemaVersion(int version) async {
    await local?.setInt(StorageKeys.schemaVersion, version);
  }

  /// `null` means "never bootstrapped" — distinct from `0`, which a server
  /// could legitimately send as its first real schema version.
  static int? getSchemaVersion() {
    return local?.getInt(StorageKeys.schemaVersion);
  }

  /// Forces the next flush to run a full bootstrap instead of a delta —
  /// used when the local caches were just wiped (a locale change) and the
  /// old cursor would otherwise ask the server for changes since a moment
  /// whose snapshot no longer exists on the device.
  static Future<void> clearSyncCursor() async {
    await local?.remove(StorageKeys.lastSyncedAt);
    await local?.remove(StorageKeys.schemaVersion);
  }

  // ── Deep links ───────────────────────────────────────────────────────────
  //
  // A push that wakes a terminated app is consumed after splash + auth.

  static Future<void> setPendingDeepLink(String link) async {
    await local?.setString(StorageKeys.pendingDeepLink, link);
  }

  static String getPendingDeepLink() {
    return local?.getString(StorageKeys.pendingDeepLink) ?? '';
  }

  static void deletePendingDeepLink() {
    local?.remove(StorageKeys.pendingDeepLink);
  }

  // ── Push permission ──────────────────────────────────────────────────────
  //
  // Asked contextually after first useful use — never cold on launch.

  static Future<void> setPushPermissionPrompted({required bool value}) async {
    await local?.setBool(StorageKeys.pushPermissionPrompted, value);
  }

  static bool getPushPermissionPrompted() {
    return local?.getBool(StorageKeys.pushPermissionPrompted) ?? false;
  }

  // ── Session teardown ─────────────────────────────────────────────────────
  //
  // Deliberately keeps the sync queue and the saved locale.

  static Future<void> clearSession() async {
    await deleteTokens();
    deleteCachedAuthUser();
    deleteCachedPermissions();
    deletePendingDeepLink();
    await setIsBiometricLoginEnabled(value: false);
  }
}

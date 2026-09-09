import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/app_localization.dart';
import 'package:machinery/core/local_storage/local_storage.dart';

/// Owns language switching.
///
/// Category names, machine types, violation types and roles are localized on
/// the server, so switching language makes cached server data stale. Every
/// cache that holds localized text registers an invalidator here; the sync
/// layer adds its own in phase 2.
class LocaleService {
  final List<Future<void> Function()> _invalidators =
      <Future<void> Function()>[];

  static const List<Locale> supportedLocales = <Locale>[
    AppLocalizations.arabicLocale,
    AppLocalizations.englishLocale,
  ];

  void registerCacheInvalidator(Future<void> Function() invalidator) {
    _invalidators.add(invalidator);
  }

  Locale resolveStartLocale() {
    return LocalStorage.getLocaleLanguage() == 'en'
        ? AppLocalizations.englishLocale
        : AppLocalizations.arabicLocale;
  }

  Future<void> change({
    required BuildContext context,
    required Locale locale,
  }) async {
    if (context.locale == locale) {
      return;
    }

    // Persist first: the Dio locale interceptor reads from storage, so the
    // very next request must already carry the new Accept-Language.
    await LocalStorage.setLocaleLanguage(locale.languageCode);
    await context.setLocale(locale);

    for (final Future<void> Function() invalidate in _invalidators) {
      await invalidate();
    }
  }
}

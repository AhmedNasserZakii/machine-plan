import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';

/// Number, date and money formatting.
///
/// Digits stay Western (0-9) in both locales on purpose. Serials, amounts and
/// dates are read aloud over the phone, checked against printed invoices and
/// retyped into other systems; Arabic-Indic digits look native but cause real
/// operational friction here.
abstract class Formatters {
  static const String _digitLocale = 'en';

  static String currency(num value, {int decimalDigits = 2}) {
    return NumberFormat.currency(
      locale: _digitLocale,
      symbol: 'ج.م ',
      decimalDigits: decimalDigits,
    ).format(value);
  }

  static String number(num value) {
    return NumberFormat.decimalPattern(_digitLocale).format(value);
  }

  static String date(DateTime value) {
    return DateFormat('yyyy/MM/dd', _digitLocale).format(value.toLocal());
  }

  static String dateTime(DateTime value) {
    return DateFormat(
      'yyyy/MM/dd — hh:mm a',
      _digitLocale,
    ).format(value.toLocal());
  }

  static String time(DateTime value) {
    return DateFormat('hh:mm a', _digitLocale).format(value.toLocal());
  }

  /// "من ٣ أيام" / "3 days ago". Counted nouns go through ICU plurals because
  /// Arabic has six plural categories — concatenating a number and a fixed
  /// word is wrong in four of them.
  static String relative(DateTime value) {
    final Duration elapsed = DateTime.now().difference(value.toLocal());

    if (elapsed.inMinutes < 1) {
      return LocaleKeys.relativeNow.tr();
    }
    if (elapsed.inHours < 1) {
      return LocaleKeys.relativeMinutes.plural(elapsed.inMinutes);
    }
    if (elapsed.inDays < 1) {
      return LocaleKeys.relativeHours.plural(elapsed.inHours);
    }
    if (elapsed.inDays < 30) {
      return LocaleKeys.relativeDays.plural(elapsed.inDays);
    }

    return date(value);
  }

  /// The API sends plain `yyyy-MM-dd` for calendar dates. Formats one for
  /// display, or returns null when it is absent or unparseable — a malformed
  /// date should leave the row hidden, not print the raw string.
  static String? isoDate(String? raw) {
    final DateTime? parsed = tryParseDate(raw);
    return parsed == null ? null : date(parsed);
  }

  static DateTime? tryParseDate(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    return DateTime.tryParse(raw);
  }
}

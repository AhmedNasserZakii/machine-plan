import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/app_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/services/locale_service.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/splash/presentation/widgets/language_option_tile.dart';

class LanguageBottomSheet extends StatelessWidget {
  const LanguageBottomSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const LanguageBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final LocaleService localeService = getIt<LocaleService>();
    final Locale currentLocale = context.locale;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(LocaleKeys.appLanguage.tr(), style: Styles.s17(context)),
            const SizedBox(height: AppSpacing.md),
            LanguageOptionTile(
              label: LocaleKeys.arabicLanguage.tr(),
              isSelected: currentLocale == AppLocalizations.arabicLocale,
              onTap: () async {
                await localeService.change(
                  context: context,
                  locale: AppLocalizations.arabicLocale,
                );
                if (context.mounted) {
                  Navigator.of(context).pop();
                }
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            LanguageOptionTile(
              label: LocaleKeys.englishLanguage.tr(),
              isSelected: currentLocale == AppLocalizations.englishLocale,
              onTap: () async {
                await localeService.change(
                  context: context,
                  locale: AppLocalizations.englishLocale,
                );
                if (context.mounted) {
                  Navigator.of(context).pop();
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

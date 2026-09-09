import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/splash/presentation/widgets/language_bottom_sheet.dart';

class LanguageToggleButton extends StatelessWidget {
  const LanguageToggleButton({super.key});

  @override
  Widget build(BuildContext context) {
    return ClickedWidget(
      onTap: () => LanguageBottomSheet.show(context),
      child: Container(
        height: 48,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: AppColors.surfaceColor,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: AppColors.borderColor),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(
              Icons.language_rounded,
              size: 18,
              color: AppColors.textSecondaryColor,
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              context.locale.languageCode == 'ar'
                  ? LocaleKeys.arabicLanguage.tr()
                  : LocaleKeys.englishLanguage.tr(),
              style: Styles.s14(context),
            ),
          ],
        ),
      ),
    );
  }
}

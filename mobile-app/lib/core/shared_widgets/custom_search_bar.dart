import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class CustomSearchBar extends StatelessWidget {
  const CustomSearchBar({
    required this.controller,
    super.key,
    this.hintText,
    this.onChanged,
    this.onSubmitted,
    this.onFilterPressed,
    this.hasActiveFilters = false,
    this.identifier,
  });

  final TextEditingController controller;
  final String? hintText;
  final void Function(String)? onChanged;
  final void Function(String)? onSubmitted;
  final VoidCallback? onFilterPressed;
  final bool hasActiveFilters;

  /// Names the input for end-to-end tests. The hint is not enough to find it
  /// by: it is translated, and two lists on the same screen can share one.
  final String? identifier;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Semantics(
            identifier: identifier,
            child: SearchBar(
              controller: controller,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              onTapOutside: (_) => FocusScope.of(context).unfocus(),
              elevation: const WidgetStatePropertyAll<double>(0),
              backgroundColor: const WidgetStatePropertyAll<Color>(
                AppColors.surfaceColor,
              ),
              overlayColor: const WidgetStatePropertyAll<Color>(
                Colors.transparent,
              ),
              constraints: const BoxConstraints(minHeight: 48, maxHeight: 48),
              side: const WidgetStatePropertyAll<BorderSide>(
                BorderSide(color: AppColors.borderColor),
              ),
              shape: WidgetStatePropertyAll<OutlinedBorder>(
                RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
              leading: const Icon(
                Icons.search_rounded,
                size: 20,
                color: AppColors.textPlaceholderColor,
              ),
              hintText: hintText ?? LocaleKeys.search.tr(),
              hintStyle: WidgetStatePropertyAll<TextStyle>(
                Styles.s14(
                  context,
                ).copyWith(color: AppColors.textPlaceholderColor),
              ),
              textStyle: WidgetStatePropertyAll<TextStyle>(Styles.s14(context)),
            ),
          ),
        ),
        if (onFilterPressed != null) ...<Widget>[
          const SizedBox(width: AppSpacing.sm),
          ClickedWidget(
            onTap: onFilterPressed,
            child: Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: hasActiveFilters
                    ? AppColors.primaryColor
                    : AppColors.surfaceColor,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: Icon(
                Icons.tune_rounded,
                size: 20,
                color: hasActiveFilters
                    ? AppColors.textOnPrimaryColor
                    : AppColors.textSecondaryColor,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// The fallback for a sticker the camera cannot read. Returns the typed code,
/// or null if dismissed.
class ManualEntrySheet extends StatefulWidget {
  const ManualEntrySheet({super.key});

  static Future<String?> show(BuildContext context) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => const ManualEntrySheet(),
    );
  }

  @override
  State<ManualEntrySheet> createState() => _ManualEntrySheetState();
}

class _ManualEntrySheetState extends State<ManualEntrySheet> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final String code = _controller.text.trim();
    if (code.isEmpty) {
      return;
    }

    Navigator.of(context).pop(code);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                LocaleKeys.scanManualEntryTitle.tr(),
                style: Styles.s17(context),
              ),
              const SizedBox(height: AppSpacing.lg),
              LabeledTextFormField(
                label: LocaleKeys.scanManualEntryTitle.tr(),
                hintText: LocaleKeys.scanManualEntryHint.tr(),
                keyboardType: TextInputType.text,
                textInputAction: TextInputAction.search,
                controller: _controller,
                // A serial reads left-to-right whatever the interface language.
                textDirection: TextDirection.ltr,
                identifier: 'manual_entry_field',
                onFieldSubmitted: (_) => _submit(),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: AppSpacing.lg),
              CustomButton(
                title: LocaleKeys.confirm.tr(),
                isLoading: false,
                height: 48,
                identifier: 'manual_entry_submit',
                onPressed: _controller.text.trim().isEmpty ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

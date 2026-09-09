import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Collects the reason behind a rejection or a cancellation.
///
/// A rejection needs one and a cancellation does not, which is the whole
/// difference between the two: refusing a delivery is an accusation that
/// somebody has to answer for, and withdrawing your own is not.
class TransferReasonSheet extends StatefulWidget {
  const TransferReasonSheet({
    required this.title,
    required this.hint,
    required this.isRequired,
    this.warning,
    super.key,
  });

  final String title;
  final String hint;
  final bool isRequired;

  /// Spelled out before the button, not after it — the rejection warning exists
  /// to stop a whole delivery being refused over one wrong machine.
  final String? warning;

  static Future<String?> show({
    required BuildContext context,
    required String title,
    required String hint,
    required bool isRequired,
    String? warning,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => TransferReasonSheet(
        title: title,
        hint: hint,
        isRequired: isRequired,
        warning: warning,
      ),
    );
  }

  @override
  State<TransferReasonSheet> createState() => _TransferReasonSheetState();
}

class _TransferReasonSheetState extends State<TransferReasonSheet> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      !widget.isRequired || _controller.text.trim().isNotEmpty;

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
              Text(widget.title, style: Styles.s17(context)),
              if (widget.warning != null) ...<Widget>[
                const SizedBox(height: AppSpacing.md),
                _Warning(text: widget.warning!),
              ],
              const SizedBox(height: AppSpacing.lg),
              LabeledTextFormField(
                label: widget.hint,
                hintText: widget.hint,
                controller: _controller,
                maxLines: 3,
                identifier: 'transfer_reason_field',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: AppSpacing.lg),
              CustomButton(
                title: LocaleKeys.confirm.tr(),
                isLoading: false,
                height: 48,
                identifier: 'transfer_reason_submit',
                onPressed: _canSubmit
                    ? () => Navigator.of(context).pop(_controller.text.trim())
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Warning extends StatelessWidget {
  const _Warning({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.warningSurfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(
            Icons.warning_amber_rounded,
            size: 16,
            color: AppColors.warningColor,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: Styles.s12(
                context,
              ).copyWith(color: AppColors.textPrimaryColor),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';

/// Letting one go.
///
/// The reason is mandatory and the server enforces a floor on its length: a
/// waiver with no explanation is indistinguishable from a favour, and this
/// record is the only thing standing between the two.
class WaiveViolationSheet extends StatefulWidget {
  const WaiveViolationSheet({super.key});

  static const int minReasonLength = 5;

  static Future<WaiveViolationParams?> show(BuildContext context) {
    return showModalBottomSheet<WaiveViolationParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => const WaiveViolationSheet(),
    );
  }

  @override
  State<WaiveViolationSheet> createState() => _WaiveViolationSheetState();
}

class _WaiveViolationSheetState extends State<WaiveViolationSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _reasonController = TextEditingController();

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  String? _validateReason(String? value) {
    final String trimmed = value?.trim() ?? '';

    if (trimmed.length < WaiveViolationSheet.minReasonLength) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    return null;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    Navigator.of(
      context,
    ).pop(WaiveViolationParams(reason: _reasonController.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  LocaleKeys.violationWaiveTitle.tr(),
                  style: Styles.s17(context),
                ),
                const SizedBox(height: AppSpacing.lg),

                LabeledTextFormField(
                  label: LocaleKeys.violationWaiverReason.tr(),
                  hintText: LocaleKeys.violationWaiverReason.tr(),
                  controller: _reasonController,
                  maxLines: 3,
                  maxLength: 500,
                  textInputAction: TextInputAction.done,
                  identifier: 'violation_waive_reason',
                  validation: _validateReason,
                ),
                const SizedBox(height: AppSpacing.lg),

                CustomButton(
                  title: LocaleKeys.violationWaive.tr(),
                  isLoading: false,
                  identifier: 'violation_waive_submit',
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

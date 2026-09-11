import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/filter_section.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';
import 'package:machinery/feature/violations/presentation/helpers/violation_labels.dart';

/// Correcting the two fields a reviewer legitimately revises on a still-open,
/// hand-raised record — everything else about it is fixed by what happened.
class EditViolationSheet extends StatefulWidget {
  const EditViolationSheet({required this.violation, super.key});

  final ViolationEntity violation;

  static Future<UpdateViolationParams?> show(
    BuildContext context, {
    required ViolationEntity violation,
  }) {
    return showModalBottomSheet<UpdateViolationParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => EditViolationSheet(violation: violation),
    );
  }

  @override
  State<EditViolationSheet> createState() => _EditViolationSheetState();
}

class _EditViolationSheetState extends State<EditViolationSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _descriptionController;
  late ViolationSeverity _severity;

  @override
  void initState() {
    super.initState();
    _descriptionController = TextEditingController(
      text: widget.violation.description,
    );
    _severity = widget.violation.severity;
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  String? _validateDescription(String? value) {
    if (value?.trim().isEmpty ?? true) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    return null;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    Navigator.of(context).pop(
      UpdateViolationParams(
        severity: _severity,
        description: _descriptionController.text.trim(),
      ),
    );
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
                  LocaleKeys.violationEditTitle.tr(),
                  style: Styles.s17(context),
                ),
                const SizedBox(height: AppSpacing.lg),

                FilterSection(
                  title: LocaleKeys.violationsFilterSeverity.tr(),
                  child: FilterChoiceRow(
                    labels: ViolationLabels.filterableSeverities
                        .map(
                          (ViolationSeverity s) => ViolationLabels.severity(s),
                        )
                        .toList(growable: false),
                    values: ViolationLabels.filterableSeverities
                        .map((ViolationSeverity s) => s.value)
                        .toList(growable: false),
                    selected: _severity.value,
                    onSelected: (String? value) => setState(
                      () => _severity = ViolationSeverity.fromJson(value),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                LabeledTextFormField(
                  label: LocaleKeys.violationDescription.tr(),
                  hintText: LocaleKeys.violationDescription.tr(),
                  controller: _descriptionController,
                  maxLines: 3,
                  maxLength: 1000,
                  textInputAction: TextInputAction.done,
                  identifier: 'violation_edit_description',
                  validation: _validateDescription,
                ),
                const SizedBox(height: AppSpacing.lg),

                CustomButton(
                  title: LocaleKeys.violationEdit.tr(),
                  isLoading: false,
                  identifier: 'violation_edit_submit',
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

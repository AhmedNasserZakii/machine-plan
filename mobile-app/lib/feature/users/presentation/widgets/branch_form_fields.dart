import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/presentation/widgets/lookup_code_upper_case_formatter.dart';
import 'package:machinery/feature/users/data/logic/branch_form/branch_form_state.dart';

/// Fields for creating or editing a branch.
class BranchFormFields extends StatelessWidget {
  const BranchFormFields({
    required this.state,
    required this.isEditing,
    required this.codeController,
    required this.nameController,
    required this.addressController,
    required this.phoneController,
    super.key,
  });

  final BranchFormReady state;
  final bool isEditing;
  final TextEditingController codeController;
  final TextEditingController nameController;
  final TextEditingController addressController;
  final TextEditingController phoneController;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (isEditing) ...<Widget>[
          Text(
            LocaleKeys.branchCode.tr(),
            style: Styles.s14(context).copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          LtrText(
            codeController.text,
            style: Styles.s15(context).copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LocaleKeys.branchCodeLocked.tr(),
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ] else
          LabeledTextFormField(
            label: LocaleKeys.branchCode.tr(),
            hintText: 'ALX',
            controller: codeController,
            identifier: 'branch_form_code',
            textDirection: TextDirection.ltr,
            validation: AppValidators.isValidBranchCode,
            errorText: state.fieldErrors['code'],
            inputFormatters: <TextInputFormatter>[
              FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9_]')),
              const LookupCodeUpperCaseFormatter(),
            ],
          ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.branchName.tr(),
          hintText: LocaleKeys.branchName.tr(),
          controller: nameController,
          identifier: 'branch_form_name',
          validation: AppValidators.isNotEmptyValidator,
          errorText: state.fieldErrors['name'],
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.branchAddress.tr(),
          hintText: LocaleKeys.branchAddress.tr(),
          controller: addressController,
          identifier: 'branch_form_address',
          maxLines: 2,
          errorText: state.fieldErrors['address'],
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.branchPhone.tr(),
          hintText: '0341234567',
          controller: phoneController,
          identifier: 'branch_form_phone',
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.done,
          textDirection: TextDirection.ltr,
          validation: AppValidators.isValidBranchPhone,
          errorText: state.fieldErrors['phone'],
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(20),
          ],
        ),
      ],
    );
  }
}

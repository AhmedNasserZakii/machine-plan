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
import 'package:machinery/feature/machines/data/logic/machine_model_form/machine_model_form_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/presentation/widgets/lookup_code_upper_case_formatter.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_type_selector.dart';

/// Fields for creating or editing a machine model in the catalogue.
class MachineModelFormFields extends StatelessWidget {
  const MachineModelFormFields({
    required this.state,
    required this.isEditing,
    required this.codeController,
    required this.nameArController,
    required this.nameEnController,
    required this.manufacturerController,
    required this.onTypeSelected,
    required this.onActiveChanged,
    super.key,
  });

  final MachineModelFormReady state;
  final bool isEditing;
  final TextEditingController codeController;
  final TextEditingController nameArController;
  final TextEditingController nameEnController;
  final TextEditingController manufacturerController;
  final ValueChanged<MachineTypeEntity> onTypeSelected;
  final ValueChanged<bool> onActiveChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (isEditing) ...<Widget>[
          Text(
            LocaleKeys.machineModelCode.tr(),
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
            LocaleKeys.machineModelCodeLocked.tr(),
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ] else
          LabeledTextFormField(
            label: LocaleKeys.machineModelCode.tr(),
            hintText: 'VERIFONE_V200',
            controller: codeController,
            identifier: 'machine_model_form_code',
            textDirection: TextDirection.ltr,
            validation: AppValidators.isValidLookupCode,
            errorText: state.fieldErrors['code'],
            inputFormatters: <TextInputFormatter>[
              FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9_]')),
              const LookupCodeUpperCaseFormatter(),
            ],
          ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.machineModelNameAr.tr(),
          hintText: LocaleKeys.machineModelNameAr.tr(),
          controller: nameArController,
          identifier: 'machine_model_form_name_ar',
          validation: AppValidators.isNotEmptyValidator,
          errorText:
              state.fieldErrors['translations.ar.name'] ??
              state.fieldErrors['nameAr'],
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.machineModelNameEn.tr(),
          hintText: LocaleKeys.machineModelNameEn.tr(),
          controller: nameEnController,
          identifier: 'machine_model_form_name_en',
          textDirection: TextDirection.ltr,
          validation: AppValidators.isNotEmptyValidator,
          errorText:
              state.fieldErrors['translations.en.name'] ??
              state.fieldErrors['nameEn'],
        ),
        const SizedBox(height: AppSpacing.md),

        MachineTypeSelector(
          types: state.types,
          selected: state.selectedType,
          onSelected: onTypeSelected,
          errorText:
              state.fieldErrors['machineTypeId'] ??
              state.fieldErrors['machineType'],
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.machineManufacturer.tr(),
          hintText: LocaleKeys.machineManufacturer.tr(),
          controller: manufacturerController,
          identifier: 'machine_model_form_manufacturer',
          errorText: state.fieldErrors['manufacturer'],
        ),

        if (isEditing) ...<Widget>[
          const SizedBox(height: AppSpacing.md),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.machineModelActive.tr()),
            subtitle: Text(LocaleKeys.machineModelActiveHint.tr()),
            value: state.isActive,
            onChanged: onActiveChanged,
          ),
        ],
      ],
    );
  }
}

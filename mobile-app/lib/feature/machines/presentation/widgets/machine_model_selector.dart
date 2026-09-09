import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';

/// Picks the model, which is also what picks the type — and therefore whether
/// the form asks for a SIM at all.
class MachineModelSelector extends StatelessWidget {
  const MachineModelSelector({
    required this.models,
    required this.selected,
    required this.onSelected,
    super.key,
    this.errorText,
  });

  final List<MachineModelEntity> models;
  final MachineModelEntity? selected;
  final ValueChanged<MachineModelEntity> onSelected;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          LocaleKeys.machineModel.tr(),
          style: Styles.s14(context).copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          identifier: 'machine_model_selector',
          child: DropdownButtonFormField<String>(
            initialValue: selected?.id,
            isExpanded: true,
            decoration: InputDecoration(
              hintText: LocaleKeys.machineSelectModel.tr(),
              errorText: errorText,
            ),
            items: models
                .map((MachineModelEntity model) {
                  return DropdownMenuItem<String>(
                    value: model.id,
                    child: Text(
                      model.label,
                      style: Styles.s14(context),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  );
                })
                .toList(growable: false),
            onChanged: (String? id) {
              if (id == null) {
                return;
              }

              onSelected(
                models.firstWhere((MachineModelEntity m) => m.id == id),
              );
            },
          ),
        ),
        if (selected != null) ...<Widget>[
          const SizedBox(height: AppSpacing.xs),
          Text(
            selected!.type.name,
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ],
      ],
    );
  }
}

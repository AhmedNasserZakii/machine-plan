import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';

/// Picks the parent machine type for a catalogue model.
class MachineTypeSelector extends StatelessWidget {
  const MachineTypeSelector({
    required this.types,
    required this.selected,
    required this.onSelected,
    super.key,
    this.errorText,
  });

  final List<MachineTypeEntity> types;
  final MachineTypeEntity? selected;
  final ValueChanged<MachineTypeEntity> onSelected;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          LocaleKeys.machineType.tr(),
          style: Styles.s14(context).copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          identifier: 'machine_model_type_selector',
          child: DropdownButtonFormField<String>(
            initialValue: selected?.id,
            isExpanded: true,
            decoration: InputDecoration(
              hintText: LocaleKeys.machineModelSelectType.tr(),
              errorText: errorText,
            ),
            items: types
                .map((MachineTypeEntity type) {
                  return DropdownMenuItem<String>(
                    value: type.id,
                    child: Text(
                      type.name,
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
                types.firstWhere((MachineTypeEntity t) => t.id == id),
              );
            },
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// A wrapping row of single-select chips. [values] is parallel to [labels],
/// and a null value is the "all" option.
class FilterChoiceRow extends StatelessWidget {
  const FilterChoiceRow({
    required this.labels,
    required this.values,
    required this.selected,
    required this.onSelected,
    super.key,
  });

  final List<String> labels;
  final List<String?> values;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: List<Widget>.generate(labels.length, (int index) {
        final String? value = values[index];
        final bool isSelected = value == selected;

        return ChoiceChip(
          label: Text(labels[index], style: Styles.s13(context)),
          selected: isSelected,
          onSelected: (_) => onSelected(value),
          showCheckmark: false,
          backgroundColor: AppColors.surfaceAltColor,
          selectedColor: AppColors.primaryLightColor,
          side: BorderSide(
            color: isSelected ? AppColors.primaryColor : AppColors.borderColor,
          ),
        );
      }),
    );
  }
}

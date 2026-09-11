import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';

class DecommissionThresholdsSheet extends StatefulWidget {
  const DecommissionThresholdsSheet({required this.current, super.key});
  final DecommissionCandidatesQueryParams current;

  static Future<DecommissionCandidatesQueryParams?> show({
    required BuildContext context,
    required DecommissionCandidatesQueryParams current,
  }) => showModalBottomSheet<DecommissionCandidatesQueryParams>(
    context: context,
    isScrollControlled: true,
    builder: (_) => DecommissionThresholdsSheet(current: current),
  );

  @override
  State<DecommissionThresholdsSheet> createState() =>
      _DecommissionThresholdsSheetState();
}

class _DecommissionThresholdsSheetState
    extends State<DecommissionThresholdsSheet> {
  late final TextEditingController _ratio = TextEditingController(
    text: widget.current.minCostRatio?.toString(),
  );
  late final TextEditingController _repairs = TextEditingController(
    text: widget.current.minRepairCount?.toString(),
  );
  late final TextEditingController _age = TextEditingController(
    text: widget.current.minAgeMonths?.toString(),
  );

  @override
  void dispose() {
    _ratio.dispose();
    _repairs.dispose();
    _age.dispose();
    super.dispose();
  }

  void _apply() {
    final double? ratioPercent = double.tryParse(_ratio.text.trim());
    final int? repairs = int.tryParse(_repairs.text.trim());
    final int? age = int.tryParse(_age.text.trim());
    Navigator.pop(
      context,
      DecommissionCandidatesQueryParams(
        minCostRatio: ratioPercent == null ? null : ratioPercent / 100,
        minRepairCount: repairs,
        minAgeMonths: age,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsetsDirectional.only(
          start: AppSpacing.md,
          end: AppSpacing.md,
          top: AppSpacing.lg,
          bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.md,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                LocaleKeys.decommissionThresholdsTitle.tr(),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: AppSpacing.lg),
              LabeledTextFormField(
                label: LocaleKeys.decommissionMinRatio.tr(),
                hintText: '60',
                controller: _ratio,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                identifier: 'decommission_min_ratio_field',
              ),
              const SizedBox(height: AppSpacing.md),
              LabeledTextFormField(
                label: LocaleKeys.decommissionMinRepairs.tr(),
                hintText: '5',
                controller: _repairs,
                keyboardType: TextInputType.number,
                identifier: 'decommission_min_repairs_field',
              ),
              const SizedBox(height: AppSpacing.md),
              LabeledTextFormField(
                label: LocaleKeys.decommissionMinAge.tr(),
                hintText: '24',
                controller: _age,
                keyboardType: TextInputType.number,
                identifier: 'decommission_min_age_field',
              ),
              const SizedBox(height: AppSpacing.lg),
              CustomButton(
                title: LocaleKeys.decommissionApplyThresholds.tr(),
                isLoading: false,
                onPressed: _apply,
                identifier: 'decommission_apply_thresholds_button',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

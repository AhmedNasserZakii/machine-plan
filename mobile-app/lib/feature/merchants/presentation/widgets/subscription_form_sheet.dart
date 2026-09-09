import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/filter_section.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';
import 'package:machinery/feature/merchants/presentation/helpers/merchant_labels.dart';

/// Arranging what a merchant pays.
///
/// A plan covers everything he holds unless a machine is picked, which is the
/// rarer case: two machines on different rates in one shop.
class SubscriptionFormSheet extends StatefulWidget {
  const SubscriptionFormSheet({required this.machines, super.key});

  final List<MachineEntity> machines;

  static Future<CreateSubscriptionParams?> show({
    required BuildContext context,
    required List<MachineEntity> machines,
  }) {
    return showModalBottomSheet<CreateSubscriptionParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => SubscriptionFormSheet(machines: machines),
    );
  }

  @override
  State<SubscriptionFormSheet> createState() => _SubscriptionFormSheetState();
}

class _SubscriptionFormSheetState extends State<SubscriptionFormSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  SubscriptionPlanType _plan = SubscriptionPlanType.monthly;
  String? _machineId;
  late DateTime _startDate;

  /// A free arrangement has no amount to collect, so the field goes away rather
  /// than sitting there demanding a zero.
  bool get _needsAmount => _plan != SubscriptionPlanType.none;

  @override
  void initState() {
    super.initState();
    _startDate = DateTime.now();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickStartDate() async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
    );

    if (picked != null && mounted) {
      setState(() => _startDate = picked);
    }
  }

  void _submit() {
    if (_needsAmount && !(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    Navigator.of(context).pop(
      CreateSubscriptionParams(
        planType: _plan,
        machineId: _machineId,
        amount: _needsAmount ? double.parse(_amountController.text.trim()) : 0,
        startDate: _startDate.toIso8601String().split('T').first,
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
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
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.85,
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
                    LocaleKeys.subscriptionAdd.tr(),
                    style: Styles.s17(context),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  FilterSection(
                    title: LocaleKeys.subscriptionPlan.tr(),
                    child: FilterChoiceRow(
                      labels: MerchantLabels.selectablePlans
                          .map(MerchantLabels.plan)
                          .toList(growable: false),
                      values: MerchantLabels.selectablePlans
                          .map((SubscriptionPlanType plan) => plan.value)
                          .toList(growable: false),
                      selected: _plan.value,
                      onSelected: (String? value) => setState(
                        () => _plan = SubscriptionPlanType.fromJson(value),
                      ),
                    ),
                  ),

                  if (widget.machines.isNotEmpty)
                    FilterSection(
                      title: LocaleKeys.subscriptionMachine.tr(),
                      child: FilterChoiceRow(
                        labels: <String>[
                          LocaleKeys.subscriptionMachineAll.tr(),
                          ...widget.machines.map(
                            (MachineEntity machine) => machine.serial,
                          ),
                        ],
                        values: <String?>[
                          null,
                          ...widget.machines.map(
                            (MachineEntity machine) => machine.id,
                          ),
                        ],
                        selected: _machineId,
                        onSelected: (String? value) =>
                            setState(() => _machineId = value),
                      ),
                    ),

                  if (_needsAmount) ...<Widget>[
                    LabeledTextFormField(
                      label: LocaleKeys.subscriptionAmount.tr(),
                      hintText: LocaleKeys.subscriptionAmount.tr(),
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      textDirection: TextDirection.ltr,
                      identifier: 'subscription_amount',
                      validation: AppValidators.isValidAmount,
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],

                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_outlined),
                    title: Text(
                      LocaleKeys.subscriptionStartDate.tr(),
                      style: Styles.s14(context),
                    ),
                    subtitle: Text(
                      Formatters.date(_startDate),
                      style: Styles.s13(
                        context,
                      ).copyWith(color: AppColors.textSecondaryColor),
                    ),
                    onTap: _pickStartDate,
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  LabeledTextFormField(
                    label: LocaleKeys.merchantNotes.tr(),
                    hintText: LocaleKeys.merchantNotes.tr(),
                    controller: _notesController,
                    maxLines: 2,
                    textInputAction: TextInputAction.done,
                    identifier: 'subscription_notes',
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  CustomButton(
                    title: LocaleKeys.save.tr(),
                    isLoading: false,
                    identifier: 'subscription_submit',
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

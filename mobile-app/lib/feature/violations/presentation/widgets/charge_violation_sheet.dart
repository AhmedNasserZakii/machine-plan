import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/filter_section.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';

/// Taking the cost off the person responsible.
///
/// There is no suggested amount: what a lost charger is worth depends on the
/// charger, and pre-filling a number would turn a judgement into a default
/// nobody reads.
class ChargeViolationSheet extends StatefulWidget {
  const ChargeViolationSheet({super.key});

  static Future<ChargeViolationParams?> show(BuildContext context) {
    return showModalBottomSheet<ChargeViolationParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => const ChargeViolationSheet(),
    );
  }

  @override
  State<ChargeViolationSheet> createState() => _ChargeViolationSheetState();
}

class _ChargeViolationSheetState extends State<ChargeViolationSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  List<LookupEntity>? _methods;
  String? _methodId;

  @override
  void initState() {
    super.initState();
    _loadMethods();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadMethods() async {
    final result = await getIt<LookupsRepo>().paymentMethods();

    if (!mounted) {
      return;
    }

    setState(() {
      _methods = result.getOrElse(() => const <LookupEntity>[]);
      _methodId = _methods!.length == 1 ? _methods!.first.id : null;
    });
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false) || _methodId == null) {
      return;
    }

    Navigator.of(context).pop(
      ChargeViolationParams(
        amount: double.parse(_amountController.text.trim()),
        paymentMethodId: _methodId!,
        chargedAt: DateTime.now().toUtc().toIso8601String(),
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<LookupEntity>? methods = _methods;

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
                  LocaleKeys.violationChargeTitle.tr(),
                  style: Styles.s17(context),
                ),
                const SizedBox(height: AppSpacing.lg),

                LabeledTextFormField(
                  label: LocaleKeys.violationChargedAmount.tr(),
                  hintText: LocaleKeys.violationChargedAmount.tr(),
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  textDirection: TextDirection.ltr,
                  identifier: 'violation_charge_amount',
                  validation: AppValidators.isValidAmount,
                ),
                const SizedBox(height: AppSpacing.md),

                if (methods == null)
                  const AppLoadingIndicator()
                else
                  FilterSection(
                    title: LocaleKeys.subscriptionCollectMethod.tr(),
                    child: FilterChoiceRow(
                      labels: methods
                          .map((LookupEntity row) => row.name)
                          .toList(growable: false),
                      values: methods
                          .map((LookupEntity row) => row.id)
                          .toList(growable: false),
                      selected: _methodId,
                      onSelected: (String? value) =>
                          setState(() => _methodId = value),
                    ),
                  ),

                LabeledTextFormField(
                  label: LocaleKeys.merchantNotes.tr(),
                  hintText: LocaleKeys.merchantNotes.tr(),
                  controller: _notesController,
                  maxLines: 2,
                  textInputAction: TextInputAction.done,
                  identifier: 'violation_charge_notes',
                ),
                const SizedBox(height: AppSpacing.lg),

                CustomButton(
                  title: LocaleKeys.violationCharge.tr(),
                  isLoading: false,
                  identifier: 'violation_charge_submit',
                  onPressed: _methodId == null ? null : _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

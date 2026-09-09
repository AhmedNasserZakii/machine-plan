import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/helper/formatters.dart';
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
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';

/// Taking money against a plan.
///
/// The amount is pre-filled from the plan but stays editable: a merchant paying
/// half is a real thing, and refusing to record it just loses the record.
class CollectSubscriptionSheet extends StatefulWidget {
  const CollectSubscriptionSheet({required this.subscription, super.key});

  final SubscriptionEntity subscription;

  static Future<CollectSubscriptionParams?> show({
    required BuildContext context,
    required SubscriptionEntity subscription,
  }) {
    return showModalBottomSheet<CollectSubscriptionParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => CollectSubscriptionSheet(subscription: subscription),
    );
  }

  @override
  State<CollectSubscriptionSheet> createState() =>
      _CollectSubscriptionSheetState();
}

class _CollectSubscriptionSheetState extends State<CollectSubscriptionSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  List<LookupEntity>? _methods;
  String? _methodId;

  @override
  void initState() {
    super.initState();
    _amountController.text = widget.subscription.amount.toString();
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
      // One method is the common case — asking someone to pick from a list of
      // one is a tap that teaches nothing.
      _methodId = _methods!.length == 1 ? _methods!.first.id : null;
    });
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false) || _methodId == null) {
      return;
    }

    Navigator.of(context).pop(
      CollectSubscriptionParams(
        amount: double.parse(_amountController.text.trim()),
        collectedAt: DateTime.now().toUtc().toIso8601String(),
        paymentMethodId: _methodId!,
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
                    LocaleKeys.subscriptionCollectTitle.tr(),
                    style: Styles.s17(context),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    Formatters.currency(widget.subscription.amount),
                    style: Styles.s13(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  LabeledTextFormField(
                    label: LocaleKeys.subscriptionCollectAmount.tr(),
                    hintText: LocaleKeys.subscriptionCollectAmount.tr(),
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    textDirection: TextDirection.ltr,
                    identifier: 'collect_amount',
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
                    identifier: 'collect_notes',
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  CustomButton(
                    title: LocaleKeys.subscriptionCollect.tr(),
                    isLoading: false,
                    identifier: 'collect_submit',
                    // The server requires a method, so the button waits for one
                    // rather than sending a request it knows will be refused.
                    onPressed: _methodId == null ? null : _submit,
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

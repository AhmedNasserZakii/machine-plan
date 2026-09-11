import 'dart:typed_data';

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/maintenance_close_rules.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/maintenance_labels.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/maintenance_responsible_picker_sheets.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';

/// Step 4 of the repair (`11.2`): the outcome, the cost, who pays, and — for a
/// `REPLACED` result — the new unit's own intake fields, all in one request
/// (`POST /maintenance-orders/:id/close`). Pushed the same way
/// `MaintenanceHandoverScreen` is (see `AppRoute.goToMaintenanceClose`),
/// sharing the detail screen's own `MaintenanceDetailCubit` rather than
/// creating a new one — a repair's close is still just one more action on the
/// order the detail screen already has open.
class MaintenanceCloseScreen extends StatefulWidget {
  const MaintenanceCloseScreen({required this.order, super.key});

  final MaintenanceOrderEntity order;

  @override
  State<MaintenanceCloseScreen> createState() =>
      _MaintenanceCloseScreenState();
}

class _MaintenanceCloseScreenState extends State<MaintenanceCloseScreen> {
  static const List<MaintenanceOrderResult> _resultOptions =
      <MaintenanceOrderResult>[
        MaintenanceOrderResult.repaired,
        MaintenanceOrderResult.replaced,
        MaintenanceOrderResult.unrepairable,
      ];

  late MaintenanceOrderResult _result =
      widget.order.result ?? MaintenanceOrderResult.repaired;

  /// Pre-set from the server's own suggestion (`order.suggestedFreeUnderWarranty`,
  /// computed by `suggestFreeUnderWarranty()` in the backend's
  /// `maintenance-rules.ts` off the machine's warranty window) — a starting
  /// point the technician can still overrule either way.
  late bool _isFreeUnderWarranty = widget.order.suggestedFreeUnderWarranty;

  late final TextEditingController _costController = TextEditingController(
    text: widget.order.cost == null ? '' : widget.order.cost.toString(),
  );

  MaintenanceResponsibleParty _responsibleParty =
      MaintenanceResponsibleParty.company;
  UserEntity? _responsibleUser;
  MerchantEntity? _responsibleMerchant;
  String? _paymentMethodId;
  String? _supplierId;
  String? _invoiceMediaId;
  Uint8List? _invoicePreview;
  bool _uploadingInvoice = false;

  late final TextEditingController _performedByController =
      TextEditingController(text: widget.order.performedByName ?? '');
  late String? _returnedAt = widget.order.returnedAt
      ?.toIso8601String()
      .split('T')
      .first;
  late final TextEditingController _notesController = TextEditingController(
    text: widget.order.notes ?? '',
  );

  // The replacement sub-form (`11.2`'s "route REPLACED through the
  // replacement form" — the dedicated standalone form is `11.3`'s; this is
  // the minimum `ReplacementMachineDto` needs to ride along in the close).
  final TextEditingController _newSerialController = TextEditingController();
  final TextEditingController _newBatteryController = TextEditingController();
  final TextEditingController _newSimController = TextEditingController();
  final TextEditingController _newBoxController = TextEditingController();
  final TextEditingController _replacementReasonController =
      TextEditingController();
  bool _hasBox = false;
  String? _replacedAt;

  List<LookupEntity>? _paymentMethods;
  List<LookupEntity>? _suppliers;
  String? _refsError;

  /// Set once the close actually goes through — swaps the form for a summary
  /// of what the server just did instead of popping straight away.
  MaintenanceOrderEntity? _closedOrder;

  @override
  void initState() {
    super.initState();
    _replacedAt = _returnedAt;
    _loadRefs();
  }

  Future<void> _loadRefs() async {
    setState(() => _refsError = null);

    final results = await (
      getIt<LookupsRepo>().paymentMethods(),
      getIt<LookupsRepo>().suppliers(),
    ).wait;

    if (!mounted) return;

    final String? failureMessage = results.$1.fold(
      (failure) => failure.errorMessage,
      (_) => null,
    );

    if (failureMessage != null) {
      setState(() => _refsError = failureMessage);
      return;
    }

    setState(() {
      _paymentMethods = results.$1.getOrElse(() => const <LookupEntity>[]);
      _suppliers = results.$2.getOrElse(() => const <LookupEntity>[]);
    });
  }

  @override
  void dispose() {
    _costController.dispose();
    _performedByController.dispose();
    _notesController.dispose();
    _newSerialController.dispose();
    _newBatteryController.dispose();
    _newSimController.dispose();
    _newBoxController.dispose();
    _replacementReasonController.dispose();
    super.dispose();
  }

  double? get _cost => double.tryParse(_costController.text.trim());

  bool get _hasValidReplacement =>
      _result != MaintenanceOrderResult.replaced ||
      (_newSerialController.text.trim().length >= 3 &&
          _newBatteryController.text.trim().length >= 3 &&
          _replacementReasonController.text.trim().length >= 5 &&
          _replacedAt != null);

  MaintenanceCloseBlockedReason? get _blockedReason =>
      maintenanceCloseBlockedReason(
        isFreeUnderWarranty: _isFreeUnderWarranty,
        cost: _cost,
        result: _result,
        responsibleParty: _responsibleParty,
        responsibleUserId: _responsibleUser?.id,
        responsibleMerchantId: _responsibleMerchant?.id,
        paymentMethodId: _paymentMethodId,
        hasReplacement: _hasValidReplacement,
      );

  void _selectResult(String? value) {
    if (value == null) return;
    setState(() => _result = MaintenanceOrderResult.fromJson(value));
  }

  void _selectResponsibleParty(String? value) {
    if (value == null) return;

    setState(() {
      _responsibleParty = MaintenanceResponsibleParty.fromJson(value);
      // A hidden field is still a stale field until it is cleared — the next
      // submit must not silently reuse a pick from a party no longer chosen.
      _responsibleUser = null;
      _responsibleMerchant = null;
      _paymentMethodId = null;
    });
  }

  Future<void> _pickResponsibleUser() async {
    final UserEntity? picked = await ResponsibleUserPickerSheet.show(
      context: context,
    );
    if (picked == null || !mounted) return;
    setState(() => _responsibleUser = picked);
  }

  Future<void> _pickResponsibleMerchant() async {
    final MerchantEntity? picked = await ResponsibleMerchantPickerSheet.show(
      context: context,
    );
    if (picked == null || !mounted) return;
    setState(() => _responsibleMerchant = picked);
  }

  Future<void> _pickInvoice(ImageSource source) async {
    final XFile? picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 90,
    );
    if (picked == null || !mounted) return;

    setState(() => _uploadingInvoice = true);

    final Uint8List raw = await picked.readAsBytes();
    final Uint8List compressed = await FlutterImageCompress.compressWithList(
      raw,
      minWidth: 1280,
      minHeight: 1280,
      quality: 70,
      autoCorrectionAngle: true,
      keepExif: false,
    );

    final result = await getIt<MaintenanceRepo>().uploadInvoice(
      jpeg: compressed,
    );

    if (!mounted) return;
    setState(() => _uploadingInvoice = false);

    result.fold(
      (failure) =>
          showErrorToast(LocaleKeys.transferPhotoUploadFailed.tr(), context),
      (String id) => setState(() {
        _invoiceMediaId = id;
        _invoicePreview = compressed;
      }),
    );
  }

  Future<void> _chooseInvoiceSource() async {
    final ImageSource? source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(LocaleKeys.transferPhotoSourceCamera.tr()),
              onTap: () => Navigator.of(context).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(LocaleKeys.transferPhotoSourceGallery.tr()),
              onTap: () => Navigator.of(context).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;
    await _pickInvoice(source);
  }

  void _removeInvoice() {
    setState(() {
      _invoiceMediaId = null;
      _invoicePreview = null;
    });
  }

  static String? _blankToNull(String raw) {
    final String trimmed = raw.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  CloseMaintenanceOrderParams _buildParams() {
    final bool chargeable = !_isFreeUnderWarranty;

    return CloseMaintenanceOrderParams(
      result: _result,
      isFreeUnderWarranty: _isFreeUnderWarranty,
      cost: chargeable ? _cost : null,
      responsibleParty: _responsibleParty,
      responsibleUserId:
          _responsibleParty == MaintenanceResponsibleParty.representative
          ? _responsibleUser?.id
          : null,
      responsibleMerchantId:
          _responsibleParty == MaintenanceResponsibleParty.merchant
          ? _responsibleMerchant?.id
          : null,
      paymentMethodId:
          (chargeable && _responsibleParty == MaintenanceResponsibleParty.company)
          ? _paymentMethodId
          : null,
      supplierId: chargeable ? _supplierId : null,
      invoiceMediaId: chargeable ? _invoiceMediaId : null,
      replacement: _result == MaintenanceOrderResult.replaced
          ? ReplacementMachineParams(
              newSerial: _newSerialController.text,
              newBatterySerial: _newBatteryController.text,
              hasBox: _hasBox,
              reason: _replacementReasonController.text,
              replacedAt: _replacedAt ?? _returnedAt!,
              newSimSerial: _blankToNull(_newSimController.text),
              newBoxSerial: _blankToNull(_newBoxController.text),
            )
          : null,
      performedByName: _blankToNull(_performedByController.text),
      returnedAt: _returnedAt!,
      notes: _blankToNull(_notesController.text),
    );
  }

  String _blockedReasonMessage(MaintenanceCloseBlockedReason reason) {
    return switch (reason) {
      MaintenanceCloseBlockedReason.costRequired =>
        LocaleKeys.maintenanceCloseCostRequired.tr(),
      MaintenanceCloseBlockedReason.responsibleUserRequired ||
      MaintenanceCloseBlockedReason.responsibleMerchantRequired ||
      MaintenanceCloseBlockedReason.paymentMethodRequired ||
      MaintenanceCloseBlockedReason.replacementRequired =>
        LocaleKeys.thisFieldIsRequired.tr(),
    };
  }

  Future<void> _submit() async {
    if (_returnedAt == null) {
      showErrorToast(LocaleKeys.thisFieldIsRequired.tr(), context);
      return;
    }

    final MaintenanceCloseBlockedReason? reason = _blockedReason;
    if (reason != null) {
      showErrorToast(_blockedReasonMessage(reason), context);
      return;
    }

    final MaintenanceDetailCubit cubit = context.read<MaintenanceDetailCubit>();
    final result = await cubit.closeOrder(_buildParams());

    if (!mounted) return;

    result.fold(
      (failure) => showErrorToast(failure.errorMessage, context),
      (MaintenanceOrderEntity order) => setState(() => _closedOrder = order),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.maintenanceCloseTitle.tr()),
      ),
      body: _closedOrder != null
          ? _buildSuccess(context, _closedOrder!)
          : _buildForm(context),
    );
  }

  Widget _buildForm(BuildContext context) {
    if (_refsError != null) {
      return AppErrorView(message: _refsError!, onRetry: _loadRefs);
    }

    final List<LookupEntity>? paymentMethods = _paymentMethods;
    final List<LookupEntity>? suppliers = _suppliers;
    if (paymentMethods == null || suppliers == null) {
      return const AppLoadingIndicator();
    }

    return BlocBuilder<MaintenanceDetailCubit, MaintenanceDetailState>(
      builder: (BuildContext context, MaintenanceDetailState state) {
        final bool isBusy =
            state is MaintenanceDetailLoaded && state.actionInProgress;

        return Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                children: <Widget>[
                  _sectionLabel(context, LocaleKeys.maintenanceCloseResult.tr()),
                  FilterChoiceRow(
                    labels: _resultOptions
                        .map(MaintenanceLabels.result)
                        .toList(growable: false),
                    values: _resultOptions
                        .map((MaintenanceOrderResult r) => r.value)
                        .toList(growable: false),
                    selected: _result.value,
                    onSelected: _selectResult,
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    value: _isFreeUnderWarranty,
                    onChanged: (bool value) =>
                        setState(() => _isFreeUnderWarranty = value),
                    title: Text(
                      LocaleKeys.maintenanceCloseFreeUnderWarranty.tr(),
                      style: Styles.s14(context),
                    ),
                    subtitle: widget.order.suggestedFreeUnderWarranty
                        ? Text(
                            LocaleKeys.maintenanceCloseWarrantySuggested.tr(),
                            style: Styles.s12(
                              context,
                            ).copyWith(color: AppColors.textSecondaryColor),
                          )
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.md),

                  if (!_isFreeUnderWarranty) ...<Widget>[
                    LabeledTextFormField(
                      label: LocaleKeys.maintenanceCloseCost.tr(),
                      hintText: '0.00',
                      controller: _costController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      onChanged: (_) => setState(() {}),
                      identifier: 'maintenance_close_cost',
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  _sectionLabel(
                    context,
                    LocaleKeys.maintenanceCloseResponsibleParty.tr(),
                  ),
                  FilterChoiceRow(
                    labels: MaintenanceLabels.filterableResponsibleParties
                        .map(MaintenanceLabels.responsibleParty)
                        .toList(growable: false),
                    values: MaintenanceLabels.filterableResponsibleParties
                        .map((MaintenanceResponsibleParty p) => p.value)
                        .toList(growable: false),
                    selected: _responsibleParty.value,
                    onSelected: _selectResponsibleParty,
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  if (_responsibleParty ==
                      MaintenanceResponsibleParty.representative) ...<Widget>[
                    _PickerTile(
                      identifier: 'maintenance_close_responsible_user',
                      label: LocaleKeys.maintenanceCloseResponsibleUser.tr(),
                      value: _responsibleUser?.fullName,
                      onTap: _pickResponsibleUser,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  if (_responsibleParty ==
                      MaintenanceResponsibleParty.merchant) ...<Widget>[
                    _PickerTile(
                      identifier: 'maintenance_close_responsible_merchant',
                      label: LocaleKeys.maintenanceCloseResponsibleMerchant.tr(),
                      value: _responsibleMerchant?.shopName,
                      onTap: _pickResponsibleMerchant,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  if (!_isFreeUnderWarranty &&
                      _responsibleParty ==
                          MaintenanceResponsibleParty.company) ...<Widget>[
                    _sectionLabel(
                      context,
                      LocaleKeys.maintenanceClosePaymentMethod.tr(),
                    ),
                    FilterChoiceRow(
                      labels: paymentMethods
                          .map((LookupEntity p) => p.name)
                          .toList(growable: false),
                      values: paymentMethods
                          .map((LookupEntity p) => p.id)
                          .toList(growable: false),
                      selected: _paymentMethodId,
                      onSelected: (String? value) =>
                          setState(() => _paymentMethodId = value),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  if (!_isFreeUnderWarranty) ...<Widget>[
                    if (suppliers.isNotEmpty) ...<Widget>[
                      _sectionLabel(
                        context,
                        LocaleKeys.maintenanceCloseSupplier.tr(),
                      ),
                      FilterChoiceRow(
                        labels: suppliers
                            .map((LookupEntity s) => s.name)
                            .toList(growable: false),
                        values: suppliers
                            .map((LookupEntity s) => s.id)
                            .toList(growable: false),
                        selected: _supplierId,
                        onSelected: (String? value) =>
                            setState(() => _supplierId = value),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                    ],
                    _InvoicePicker(
                      preview: _invoicePreview,
                      isUploading: _uploadingInvoice,
                      onPick: _chooseInvoiceSource,
                      onRemove: _invoiceMediaId == null
                          ? null
                          : _removeInvoice,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  _EffectPreviewCard(
                    effect: maintenanceCloseEffectFor(
                      isFreeUnderWarranty: _isFreeUnderWarranty,
                      cost: _cost ?? 0,
                      responsibleParty: _responsibleParty,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  if (_result == MaintenanceOrderResult.replaced) ...<Widget>[
                    DetailCard(
                      title: LocaleKeys.maintenanceCloseNeedsReplacement.tr(),
                      icon: Icons.swap_horiz_outlined,
                      children: <Widget>[
                        LabeledTextFormField(
                          label: LocaleKeys.replacementNewSerial.tr(),
                          hintText: '',
                          controller: _newSerialController,
                          onChanged: (_) => setState(() {}),
                          identifier: 'maintenance_close_new_serial',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        LabeledTextFormField(
                          label: LocaleKeys.replacementNewBattery.tr(),
                          hintText: '',
                          controller: _newBatteryController,
                          onChanged: (_) => setState(() {}),
                          identifier: 'maintenance_close_new_battery',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        LabeledTextFormField(
                          label: LocaleKeys.replacementNewSim.tr(),
                          hintText: '',
                          controller: _newSimController,
                          identifier: 'maintenance_close_new_sim',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        LabeledTextFormField(
                          label: LocaleKeys.replacementNewBox.tr(),
                          hintText: '',
                          controller: _newBoxController,
                          identifier: 'maintenance_close_new_box',
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          value: _hasBox,
                          onChanged: (bool value) =>
                              setState(() => _hasBox = value),
                          title: Text(
                            LocaleKeys.replacementHasBox.tr(),
                            style: Styles.s14(context),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        LabeledTextFormField(
                          label: LocaleKeys.replacementReason.tr(),
                          hintText: '',
                          controller: _replacementReasonController,
                          maxLines: 2,
                          onChanged: (_) => setState(() {}),
                          identifier: 'maintenance_close_replacement_reason',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _DateField(
                          label: LocaleKeys.replacementReplacedAt.tr(),
                          value: _replacedAt,
                          onPicked: (String? date) =>
                              setState(() => _replacedAt = date),
                          identifier: 'maintenance_close_replaced_at',
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  LabeledTextFormField(
                    label: LocaleKeys.maintenancePerformedBy.tr(),
                    hintText: '',
                    controller: _performedByController,
                    identifier: 'maintenance_close_performed_by',
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  _DateField(
                    label: LocaleKeys.maintenanceCloseReturnedAt.tr(),
                    value: _returnedAt,
                    onPicked: (String? date) =>
                        setState(() => _returnedAt = date),
                    identifier: 'maintenance_close_returned_at',
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  LabeledTextFormField(
                    label: LocaleKeys.maintenanceNotes.tr(),
                    hintText: '',
                    controller: _notesController,
                    maxLines: 3,
                    identifier: 'maintenance_close_notes',
                  ),
                ],
              ),
            ),
            SafeArea(
              child: Container(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                decoration: const BoxDecoration(
                  color: AppColors.surfaceColor,
                  border: Border(top: BorderSide(color: AppColors.borderColor)),
                ),
                child: CustomButton(
                  title: LocaleKeys.maintenanceCloseSubmit.tr(),
                  isLoading: isBusy,
                  height: 48,
                  width: double.infinity,
                  identifier: 'maintenance_close_submit',
                  onPressed: isBusy ? null : _submit,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSuccess(BuildContext context, MaintenanceOrderEntity order) {
    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: ListView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              children: <Widget>[
                const SizedBox(height: AppSpacing.lg),
                const Icon(
                  Icons.check_circle_outline_rounded,
                  size: 56,
                  color: AppColors.successColor,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  LocaleKeys.maintenanceClosedSuccess.tr(),
                  textAlign: TextAlign.center,
                  style: Styles.s17(context).copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.lg),
                DetailCard(
                  title: order.referenceNo,
                  icon: Icons.build_circle_outlined,
                  children: <Widget>[
                    DetailRow(
                      label: LocaleKeys.maintenanceCloseResult.tr(),
                      value: order.result == null
                          ? null
                          : MaintenanceLabels.result(order.result!),
                    ),
                    DetailRow(
                      label: LocaleKeys.maintenanceCost.tr(),
                      value: order.isFreeUnderWarranty
                          ? LocaleKeys.maintenanceFreeUnderWarranty.tr()
                          : (order.cost == null
                                ? null
                                : Formatters.currency(order.cost!)),
                    ),
                    DetailRow(
                      label: LocaleKeys.maintenanceResponsibleParty.tr(),
                      value: order.responsibleParty == null
                          ? null
                          : MaintenanceLabels.responsibleParty(
                              order.responsibleParty!,
                            ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                _EffectPreviewCard(
                  effect: maintenanceCloseEffectFor(
                    isFreeUnderWarranty: order.isFreeUnderWarranty,
                    cost: order.cost ?? 0,
                    responsibleParty:
                        order.responsibleParty ?? MaintenanceResponsibleParty.company,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: CustomButton(
              title: LocaleKeys.confirm.tr(),
              isLoading: false,
              height: 48,
              width: double.infinity,
              identifier: 'maintenance_close_done',
              onPressed: () => Navigator.of(context).pop(true),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Text(
        text,
        style: Styles.s14(
          context,
        ).copyWith(fontWeight: FontWeight.w600, color: AppColors.textSecondaryColor),
      ),
    );
  }
}

/// What closing with the form's current fields will post — the same wording
/// re-shown, unchanged, once the close has actually gone through (see
/// `_buildSuccess`), since the amounts the server posted are exactly what was
/// submitted.
class _EffectPreviewCard extends StatelessWidget {
  const _EffectPreviewCard({required this.effect});

  final MaintenanceCloseEffect effect;

  @override
  Widget build(BuildContext context) {
    final String message = switch (effect.kind) {
      MaintenanceCloseEffectKind.none =>
        LocaleKeys.maintenanceClosePreviewNone.tr(),
      MaintenanceCloseEffectKind.companyExpense =>
        LocaleKeys.maintenanceClosePreviewExpense.tr(
          args: <String>[Formatters.currency(effect.amount)],
        ),
      MaintenanceCloseEffectKind.representativeViolation =>
        LocaleKeys.maintenanceClosePreviewViolation.tr(
          args: <String>[Formatters.currency(effect.amount)],
        ),
      MaintenanceCloseEffectKind.merchantFee =>
        LocaleKeys.maintenanceClosePreviewSubscriptionFee.tr(
          args: <String>[Formatters.currency(effect.amount)],
        ),
    };

    return DetailCard(
      title: LocaleKeys.maintenanceClosePreviewTitle.tr(),
      icon: Icons.receipt_long_outlined,
      children: <Widget>[Text(message, style: Styles.s13(context))],
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.identifier,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String identifier;
  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: identifier,
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
        ),
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: AppColors.borderColor),
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        title: Text(label, style: Styles.s14(context)),
        subtitle: Text(
          value ?? LocaleKeys.thisFieldIsRequired.tr(),
          style: Styles.s13(context).copyWith(
            color: value == null
                ? AppColors.dangerColor
                : AppColors.textSecondaryColor,
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class _InvoicePicker extends StatelessWidget {
  const _InvoicePicker({
    required this.preview,
    required this.isUploading,
    required this.onPick,
    required this.onRemove,
  });

  final Uint8List? preview;
  final bool isUploading;
  final VoidCallback onPick;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          LocaleKeys.maintenanceCloseInvoice.tr(),
          style: Styles.s14(
            context,
          ).copyWith(fontWeight: FontWeight.w600, color: AppColors.textSecondaryColor),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (preview != null)
          Stack(
            children: <Widget>[
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.md),
                child: Image.memory(
                  preview!,
                  height: 120,
                  width: 120,
                  fit: BoxFit.cover,
                ),
              ),
              PositionedDirectional(
                top: 4,
                end: 4,
                child: InkWell(
                  onTap: onRemove,
                  child: const CircleAvatar(
                    radius: 12,
                    backgroundColor: Colors.black54,
                    child: Icon(Icons.close, size: 14, color: Colors.white),
                  ),
                ),
              ),
            ],
          )
        else
          Semantics(
            identifier: 'maintenance_close_invoice_pick',
            child: OutlinedButton.icon(
              onPressed: isUploading ? null : onPick,
              icon: isUploading
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.attach_file_outlined),
              label: Text(LocaleKeys.maintenanceCloseInvoice.tr()),
            ),
          ),
      ],
    );
  }
}

/// Same inline `showDatePicker` pattern as `MaintenanceCreateScreen`'s
/// `_DateField` — there is no shared date-field widget in the codebase to
/// import instead, and this screen needs it twice (`returnedAt`, and
/// `replacedAt` inside the replacement sub-form).
class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onPicked,
    required this.identifier,
  });

  final String label;
  final String? value;
  final ValueChanged<String?> onPicked;
  final String identifier;

  static final DateTime _earliest = DateTime(2015);

  Future<void> _pick(BuildContext context) async {
    final DateTime now = DateTime.now();

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: Formatters.tryParseDate(value) ?? now,
      firstDate: _earliest,
      lastDate: now,
    );

    if (picked == null) return;

    onPicked(picked.toIso8601String().split('T').first);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: Styles.s14(
            context,
          ).copyWith(fontWeight: FontWeight.w600, color: AppColors.textSecondaryColor),
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          identifier: identifier,
          child: InkWell(
            onTap: () => _pick(context),
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: InputDecorator(
              decoration: const InputDecoration(
                suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
              ),
              child: Text(
                Formatters.isoDate(value) ?? label,
                style: Styles.s14(
                  context,
                ).copyWith(color: value == null ? AppColors.textDisabledColor : null),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_replacement/machine_replacement_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_replacement/machine_replacement_state.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/replacement_form_rules.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/replacement_chain_preview.dart';

class MachineReplacementScreen extends StatefulWidget {
  const MachineReplacementScreen({required this.machine, super.key});

  final MachineEntity machine;

  @override
  State<MachineReplacementScreen> createState() =>
      _MachineReplacementScreenState();
}

class _MachineReplacementScreenState extends State<MachineReplacementScreen> {
  final TextEditingController _serial = TextEditingController();
  final TextEditingController _battery = TextEditingController();
  final TextEditingController _sim = TextEditingController();
  final TextEditingController _box = TextEditingController();
  final TextEditingController _reason = TextEditingController();

  bool _hasBox = true;
  String? _warrantyStart;
  String? _warrantyEnd;
  late String _replacedAt;
  ReplacementFormErrors _errors = const ReplacementFormErrors();

  @override
  void initState() {
    super.initState();
    _replacedAt = DateTime.now().toIso8601String().split('T').first;
    _serial.addListener(_refreshPreview);
  }

  @override
  void dispose() {
    _serial.removeListener(_refreshPreview);
    _serial.dispose();
    _battery.dispose();
    _sim.dispose();
    _box.dispose();
    _reason.dispose();
    super.dispose();
  }

  void _refreshPreview() => setState(() {});

  Future<void> _scan(TextEditingController controller, String titleKey) async {
    final String? value = await AppRoute.goToRawBarcodeScanner(
      context: context,
      titleKey: titleKey,
    );
    if (value != null && mounted) setState(() => controller.text = value);
  }

  Future<void> _pickDate({
    required String? value,
    required ValueChanged<String> onPicked,
    bool allowFuture = true,
  }) async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: Formatters.tryParseDate(value) ?? now,
      firstDate: DateTime(2015),
      lastDate: allowFuture ? DateTime(now.year + 10) : now,
    );
    if (picked != null && mounted) {
      onPicked(picked.toIso8601String().split('T').first);
    }
  }

  void _submit() {
    final ReplacementFormErrors errors = validateReplacementForm(
      oldSerial: widget.machine.serial,
      oldBatterySerial: widget.machine.battery?.serial,
      oldSimSerial: widget.machine.simSerial,
      newSerial: _serial.text,
      newBatterySerial: _battery.text,
      newSimSerial: _sim.text,
      requiresSim: widget.machine.type.requiresSim,
      reason: _reason.text,
      warrantyStart: _warrantyStart,
      warrantyEnd: _warrantyEnd,
      requiredMessage: LocaleKeys.thisFieldIsRequired.tr(),
      tooShortMessage: LocaleKeys.replacementMinimumLength.tr(),
      mustBeDifferentMessage: LocaleKeys.replacementSerialMustDiffer.tr(),
      warrantyOrderMessage: LocaleKeys.replacementWarrantyOrder.tr(),
    );
    setState(() => _errors = errors);
    if (!errors.isValid) return;

    context.read<MachineReplacementCubit>().submit(
      ReplacementMachineParams(
        newSerial: _serial.text,
        newBatterySerial: _battery.text,
        newSimSerial: widget.machine.type.requiresSim ? _sim.text : null,
        newBoxSerial: _box.text,
        hasBox: _hasBox,
        reason: _reason.text,
        replacedAt: DateTime.parse(_replacedAt).toUtc().toIso8601String(),
        newWarrantyStart: _warrantyStart,
        newWarrantyEnd: _warrantyEnd,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.machineReplaceTitle.tr()),
      ),
      body: BlocConsumer<MachineReplacementCubit, MachineReplacementState>(
        listener: (BuildContext context, MachineReplacementState state) {
          if (state is MachineReplacementFailure) {
            showErrorToast(state.errorMessage, context);
          } else if (state is MachineReplacementRefreshFailure) {
            showErrorToast(state.errorMessage, context);
            AppRoute.goBack(context: context, result: true);
          } else if (state is MachineReplacementSubmitted) {
            showSuccessToast(LocaleKeys.replacementSuccess.tr(), context);
            AppRoute.goBack(context: context, result: true);
          }
        },
        builder: (BuildContext context, MachineReplacementState state) {
          final MachineReplacementReady? ready =
              state is MachineReplacementReady ? state : null;
          return SafeArea(
            child: Column(
              children: <Widget>[
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        ReplacementChainPreview(
                          oldMachine: widget.machine,
                          newSerial: _serial.text,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        _serialField(
                          labelKey: LocaleKeys.replacementNewSerial,
                          controller: _serial,
                          error:
                              _errors.newSerial ??
                              ready?.fieldErrors['newSerial'],
                          identifier: 'replacement_new_serial_field',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _serialField(
                          labelKey: LocaleKeys.replacementNewBattery,
                          controller: _battery,
                          error:
                              _errors.newBatterySerial ??
                              ready?.fieldErrors['newBattery.serial'] ??
                              ready?.fieldErrors['newBattery'],
                          identifier: 'replacement_new_battery_field',
                        ),
                        if (widget.machine.type.requiresSim) ...<Widget>[
                          const SizedBox(height: AppSpacing.md),
                          _serialField(
                            labelKey: LocaleKeys.replacementNewSim,
                            controller: _sim,
                            error:
                                _errors.newSimSerial ??
                                ready?.fieldErrors['newSimSerial'],
                            identifier: 'replacement_new_sim_field',
                          ),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        _serialField(
                          labelKey: LocaleKeys.replacementNewBox,
                          controller: _box,
                          error: ready?.fieldErrors['newBoxSerial'],
                          identifier: 'replacement_new_box_field',
                        ),
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title: Text(LocaleKeys.replacementHasBox.tr()),
                          value: _hasBox,
                          onChanged: (bool value) =>
                              setState(() => _hasBox = value),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          LocaleKeys.replacementWarrantyTitle.tr(),
                          style: Styles.s15(
                            context,
                          ).copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: _dateField(
                                label: LocaleKeys.machineWarrantyStart.tr(),
                                value: _warrantyStart,
                                onTap: () => _pickDate(
                                  value: _warrantyStart,
                                  onPicked: (String value) =>
                                      setState(() => _warrantyStart = value),
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: _dateField(
                                label: LocaleKeys.machineWarrantyEnd.tr(),
                                value: _warrantyEnd,
                                onTap: () => _pickDate(
                                  value: _warrantyEnd,
                                  onPicked: (String value) =>
                                      setState(() => _warrantyEnd = value),
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (_errors.warranty != null) ...<Widget>[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            _errors.warranty!,
                            style: Styles.s12(
                              context,
                            ).copyWith(color: AppColors.dangerColor),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        _dateField(
                          label: LocaleKeys.replacementReplacedAt.tr(),
                          value: _replacedAt,
                          onTap: () => _pickDate(
                            value: _replacedAt,
                            allowFuture: false,
                            onPicked: (String value) =>
                                setState(() => _replacedAt = value),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        LabeledTextFormField(
                          label: LocaleKeys.replacementReason.tr(),
                          hintText: LocaleKeys.replacementReason.tr(),
                          controller: _reason,
                          maxLines: 3,
                          maxLength: 500,
                          errorText:
                              _errors.reason ?? ready?.fieldErrors['reason'],
                          identifier: 'replacement_reason_field',
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  child: CustomButton(
                    title: LocaleKeys.replacementSubmit.tr(),
                    isLoading: ready?.isSubmitting ?? false,
                    onPressed: ready == null ? null : _submit,
                    identifier: 'replacement_submit_button',
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _serialField({
    required String labelKey,
    required TextEditingController controller,
    required String? error,
    required String identifier,
  }) {
    return LabeledTextFormField(
      label: labelKey.tr(),
      hintText: labelKey.tr(),
      controller: controller,
      maxLength: 100,
      textDirection: TextDirection.ltr,
      errorText: error,
      suffixIcon: IconButton(
        onPressed: () => _scan(controller, labelKey),
        tooltip: LocaleKeys.replacementScan.tr(),
        icon: const Icon(Icons.qr_code_scanner_rounded),
      ),
      identifier: identifier,
    );
  }

  Widget _dateField({
    required String label,
    required String? value,
    required VoidCallback onTap,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: Styles.s14(context).copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: InputDecorator(
            decoration: const InputDecoration(
              suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
            ),
            child: Text(Formatters.isoDate(value) ?? label),
          ),
        ),
      ],
    );
  }
}

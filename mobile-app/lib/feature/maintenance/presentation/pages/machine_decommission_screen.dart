import 'dart:typed_data';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_decommission/machine_decommission_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_decommission/machine_decommission_state.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/decommission_cost_snapshot_card.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/presentation/widgets/handover_signature_card.dart';

class MachineDecommissionScreen extends StatefulWidget {
  const MachineDecommissionScreen({required this.machine, super.key});
  final MachineEntity machine;

  @override
  State<MachineDecommissionScreen> createState() =>
      _MachineDecommissionScreenState();
}

class _MachineDecommissionScreenState extends State<MachineDecommissionScreen> {
  final TextEditingController _notes = TextEditingController();
  final HandoverSignatureController _signature = HandoverSignatureController();
  String? _reasonId;
  late String _date;

  @override
  void initState() {
    super.initState();
    _date = DateTime.now().toIso8601String().split('T').first;
    context.read<MachineDecommissionCubit>().load();
  }

  @override
  void dispose() {
    _notes.dispose();
    _signature.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: Formatters.tryParseDate(_date) ?? now,
      firstDate: DateTime(2015),
      lastDate: now,
    );
    if (picked != null && mounted) {
      setState(() => _date = picked.toIso8601String().split('T').first);
    }
  }

  Future<void> _submit() async {
    if (_reasonId == null) {
      showErrorToast(LocaleKeys.decommissionReasonRequired.tr(), context);
      return;
    }
    if (_notes.text.trim().length < 5) {
      showErrorToast(LocaleKeys.decommissionNotesRequired.tr(), context);
      return;
    }

    Uint8List? drawn;
    SignatureParams? biometric;
    if (_signature.method == SignatureMethod.biometric) {
      if (!_signature.isBiometricVerified) {
        showErrorToast(LocaleKeys.signatureBiometricRequired.tr(), context);
        return;
      }
      biometric = SignatureParams(
        method: SignatureMethod.biometric,
        deviceId: _signature.verifiedDeviceId,
        deviceModel: _signature.verifiedDeviceModel,
      );
    } else {
      drawn = await _signature.drawn.toPngBytes();
      if (!mounted) return;
      if (drawn == null) {
        showErrorToast(LocaleKeys.transferSignatureRequired.tr(), context);
        return;
      }
    }

    final confirmed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.decommissionConfirmTitle.tr(),
      description: LocaleKeys.decommissionConfirmDescription.tr(),
      confirmLabel: LocaleKeys.decommissionSubmit.tr(),
      isDestructive: true,
      icon: Icons.delete_forever_rounded,
      confirmIdentifier: 'decommission_confirm_button',
    );
    if (!confirmed || !mounted) return;

    await context.read<MachineDecommissionCubit>().submit(
      reasonId: _reasonId!,
      notes: _notes.text.trim(),
      decommissionedAt: DateTime.parse(_date).toUtc().toIso8601String(),
      drawnSignature: drawn,
      biometricSignature: biometric,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.machineDecommissionTitle.tr()),
      ),
      body: BlocConsumer<MachineDecommissionCubit, MachineDecommissionState>(
        listener: (context, state) {
          if (state is MachineDecommissionSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          } else if (state is MachineDecommissionSubmitted) {
            showSuccessToast(LocaleKeys.decommissionSuccess.tr(), context);
            AppRoute.goBack(context: context, result: true);
          }
        },
        builder: (context, state) => switch (state) {
          MachineDecommissionFailure(:final errorMessage, :final isOffline) =>
            AppErrorView(
              message: isOffline
                  ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                  : errorMessage,
              onRetry: () => context.read<MachineDecommissionCubit>().load(),
            ),
          MachineDecommissionReady() => _form(context, state),
          _ => const AppLoadingIndicator(),
        },
      ),
    );
  }

  Widget _form(BuildContext context, MachineDecommissionReady state) {
    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DecommissionCostSnapshotCard(summary: state.summary),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    LocaleKeys.decommissionReason.tr(),
                    style: Styles.s14(context).copyWith(
                      color: AppColors.textSecondaryColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  FilterChoiceRow(
                    labels: state.reasons
                        .map((LookupEntity e) => e.name)
                        .toList(),
                    values: state.reasons
                        .map((LookupEntity e) => e.id)
                        .toList(),
                    selected: _reasonId,
                    onSelected: (value) => setState(() => _reasonId = value),
                  ),
                  if (state.fieldErrors['reasonId'] != null)
                    Text(
                      state.fieldErrors['reasonId']!,
                      style: Styles.s12(
                        context,
                      ).copyWith(color: AppColors.dangerColor),
                    ),
                  const SizedBox(height: AppSpacing.md),
                  LabeledTextFormField(
                    label: LocaleKeys.decommissionNotes.tr(),
                    hintText: LocaleKeys.decommissionNotesHint.tr(),
                    controller: _notes,
                    maxLines: 4,
                    maxLength: 1000,
                    errorText: state.fieldErrors['notes'],
                    identifier: 'decommission_notes_field',
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    LocaleKeys.decommissionAt.tr(),
                    style: Styles.s14(
                      context,
                    ).copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  InkWell(
                    onTap: _pickDate,
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        suffixIcon: Icon(
                          Icons.calendar_today_outlined,
                          size: 18,
                        ),
                      ),
                      child: Text(Formatters.isoDate(_date) ?? _date),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  HandoverSignatureCard(
                    controller: _signature,
                    reason: LocaleKeys.decommissionSignatureReason.tr(),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: CustomButton(
              title: LocaleKeys.decommissionSubmit.tr(),
              isLoading: state.isSubmitting,
              onPressed: _submit,
              backgroundColor: AppColors.dangerColor,
              identifier: 'decommission_submit_button',
            ),
          ),
        ],
      ),
    );
  }
}

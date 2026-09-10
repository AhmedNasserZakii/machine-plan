import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_create/maintenance_create_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_create/maintenance_create_state.dart';

/// Opened straight from a machine's own detail screen (`11.1`) — the machine
/// is already known, so there is no picker, only what the trip out is for.
class MaintenanceCreateScreen extends StatefulWidget {
  const MaintenanceCreateScreen({
    required this.machineId,
    required this.machineSerial,
    super.key,
  });

  final String machineId;
  final String machineSerial;

  @override
  State<MaintenanceCreateScreen> createState() =>
      _MaintenanceCreateScreenState();
}

class _MaintenanceCreateScreenState extends State<MaintenanceCreateScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _faultController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<MaintenanceCreateCubit>().load();
  }

  @override
  void dispose() {
    _faultController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _submit(MaintenanceCreateReady state) {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    if (state.locationId == null) {
      showErrorToast(LocaleKeys.thisFieldIsRequired.tr(), context);
      return;
    }

    if (state.sentAt == null) {
      showErrorToast(LocaleKeys.thisFieldIsRequired.tr(), context);
      return;
    }

    final String notes = _notesController.text.trim();

    context.read<MaintenanceCreateCubit>().submit(
      machineId: widget.machineId,
      reportedFault: _faultController.text.trim(),
      notes: notes.isEmpty ? null : notes,
    );
  }

  String? _requiredValidator(String? value) {
    return (value == null || value.trim().isEmpty)
        ? LocaleKeys.thisFieldIsRequired.tr()
        : null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.maintenanceCreateTitle.tr()),
      ),
      body: BlocConsumer<MaintenanceCreateCubit, MaintenanceCreateState>(
        listener: (BuildContext context, MaintenanceCreateState state) {
          if (state is MaintenanceCreateSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          }

          if (state is MaintenanceCreateSubmitted) {
            showSuccessToast(LocaleKeys.maintenanceCreatedSuccess.tr(), context);
            AppRoute.goBack(context: context, result: state.order);
          }
        },
        builder: (BuildContext context, MaintenanceCreateState state) {
          return switch (state) {
            MaintenanceCreateLoadFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MaintenanceCreateCubit>().load(),
              ),
            MaintenanceCreateReady() => _buildForm(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, MaintenanceCreateReady state) {
    final MaintenanceCreateCubit cubit = context.read<MaintenanceCreateCubit>();

    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      LocaleKeys.maintenanceSelectMachine.tr(),
                      style: Styles.s14(context).copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    LtrText(
                      widget.machineSerial,
                      style: Styles.mono(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    Text(
                      LocaleKeys.maintenanceSelectLocation.tr(),
                      style: Styles.s14(context).copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    FilterChoiceRow(
                      labels: state.locations
                          .map((LookupEntity l) => l.name)
                          .toList(growable: false),
                      values: state.locations
                          .map((LookupEntity l) => l.id)
                          .toList(growable: false),
                      selected: state.locationId,
                      onSelected: (String? value) {
                        if (value != null) cubit.selectLocation(value);
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    LabeledTextFormField(
                      label: LocaleKeys.maintenanceReportedFault.tr(),
                      hintText: LocaleKeys.maintenanceReportedFaultHint.tr(),
                      controller: _faultController,
                      maxLines: 3,
                      validation: _requiredValidator,
                      identifier: 'maintenance_create_fault',
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    _DateField(
                      label: LocaleKeys.maintenanceSentAt.tr(),
                      value: state.sentAt,
                      onPicked: cubit.setSentAt,
                      identifier: 'maintenance_create_sent_at',
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    LabeledTextFormField(
                      label: LocaleKeys.maintenanceNotes.tr(),
                      hintText: '',
                      controller: _notesController,
                      maxLines: 3,
                      identifier: 'maintenance_create_notes',
                    ),
                  ],
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: const BoxDecoration(
              color: AppColors.surfaceColor,
              border: Border(top: BorderSide(color: AppColors.borderColor)),
            ),
            child: CustomButton(
              title: LocaleKeys.maintenanceCreateSubmit.tr(),
              isLoading: state.isSubmitting,
              height: 48,
              width: double.infinity,
              identifier: 'maintenance_create_submit',
              onPressed: state.isSubmitting ? null : () => _submit(state),
            ),
          ),
        ],
      ),
    );
  }
}

/// Same inline `showDatePicker` pattern as `MachineFormFields`'s `_DateField`
/// — there is no shared date-field widget in the codebase to import instead.
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
          style: Styles.s14(context).copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondaryColor,
          ),
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
                style: Styles.s14(context).copyWith(
                  color: value == null ? AppColors.textDisabledColor : null,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

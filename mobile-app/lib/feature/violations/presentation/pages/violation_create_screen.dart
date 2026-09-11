import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
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
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/violations/data/logic/violation_create/violation_create_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violation_create/violation_create_state.dart';
import 'package:machinery/feature/violations/presentation/helpers/violation_labels.dart';
import 'package:machinery/feature/violations/presentation/widgets/violation_machine_picker_sheet.dart';
import 'package:machinery/feature/violations/presentation/widgets/violation_user_picker_sheet.dart';

/// Manual entry — the register's counterpart to the return-leg detector, for
/// whatever it does not catch on its own.
class ViolationCreateScreen extends StatefulWidget {
  const ViolationCreateScreen({super.key});

  @override
  State<ViolationCreateScreen> createState() => _ViolationCreateScreenState();
}

class _ViolationCreateScreenState extends State<ViolationCreateScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ViolationCreateCubit>().load();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickUser() async {
    final UserEntity? user = await ViolationUserPickerSheet.show(
      context: context,
    );
    if (user != null && mounted) {
      context.read<ViolationCreateCubit>().selectUser(user);
    }
  }

  Future<void> _pickMachine() async {
    final MachineEntity? machine = await ViolationMachinePickerSheet.show(
      context: context,
    );
    if (machine != null && mounted) {
      context.read<ViolationCreateCubit>().selectMachine(machine);
    }
  }

  void _submit(ViolationCreateReady state) {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    if (state.typeId == null || state.severity == null) {
      showErrorToast(LocaleKeys.thisFieldIsRequired.tr(), context);
      return;
    }

    if (state.user == null) {
      showErrorToast(LocaleKeys.violationSelectUser.tr(), context);
      return;
    }

    context.read<ViolationCreateCubit>().submit(
      description: _descriptionController.text.trim(),
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
        title: Text(LocaleKeys.violationRaiseTitle.tr()),
      ),
      body: BlocConsumer<ViolationCreateCubit, ViolationCreateState>(
        listener: (BuildContext context, ViolationCreateState state) {
          if (state is ViolationCreateSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          }

          if (state is ViolationCreateSubmitted) {
            showSuccessToast(LocaleKeys.violationRaised.tr(), context);
            AppRoute.goBack(context: context, result: state.violation);
          }
        },
        builder: (BuildContext context, ViolationCreateState state) {
          return switch (state) {
            ViolationCreateLoadFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<ViolationCreateCubit>().load(),
              ),
            ViolationCreateReady() => _buildForm(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, ViolationCreateReady state) {
    final ViolationCreateCubit cubit = context.read<ViolationCreateCubit>();

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
                      LocaleKeys.violationType.tr(),
                      style: Styles.s14(context).copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    FilterChoiceRow(
                      labels: state.types
                          .map((LookupEntity t) => t.name)
                          .toList(growable: false),
                      values: state.types
                          .map((LookupEntity t) => t.id)
                          .toList(growable: false),
                      selected: state.typeId,
                      onSelected: (String? value) {
                        if (value != null) cubit.selectType(value);
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    if (state.severity != null) ...<Widget>[
                      Text(
                        LocaleKeys.violationsFilterSeverity.tr(),
                        style: Styles.s14(context).copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondaryColor,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      FilterChoiceRow(
                        labels: ViolationLabels.filterableSeverities
                            .map(
                              (ViolationSeverity s) =>
                                  ViolationLabels.severity(s),
                            )
                            .toList(growable: false),
                        values: ViolationLabels.filterableSeverities
                            .map((ViolationSeverity s) => s.value)
                            .toList(growable: false),
                        selected: state.severity!.value,
                        onSelected: (String? value) {
                          if (value != null) {
                            cubit.selectSeverity(
                              ViolationSeverity.fromJson(value),
                            );
                          }
                        },
                      ),
                      const SizedBox(height: AppSpacing.lg),
                    ],

                    Text(
                      LocaleKeys.violationAgainst.tr(),
                      style: Styles.s14(context).copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _PickerTile(
                      identifier: 'violation_create_user_tile',
                      icon: Icons.person_outline,
                      label:
                          state.user?.fullName ??
                          LocaleKeys.violationSelectUser.tr(),
                      onTap: _pickUser,
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    Text(
                      LocaleKeys.violationMachine.tr(),
                      style: Styles.s14(context).copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _PickerTile(
                      identifier: 'violation_create_machine_tile',
                      icon: Icons.inventory_2_outlined,
                      label:
                          state.machine?.serial ??
                          LocaleKeys.violationSelectMachine.tr(),
                      onTap: _pickMachine,
                      onClear: state.machine == null
                          ? null
                          : () => cubit.selectMachine(null),
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    LabeledTextFormField(
                      label: LocaleKeys.violationDescription.tr(),
                      hintText: LocaleKeys.violationDescription.tr(),
                      controller: _descriptionController,
                      maxLines: 3,
                      maxLength: 1000,
                      validation: _requiredValidator,
                      identifier: 'violation_create_description',
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
              title: LocaleKeys.violationRaise.tr(),
              isLoading: state.isSubmitting,
              height: 48,
              width: double.infinity,
              identifier: 'violation_create_submit',
              onPressed: state.isSubmitting ? null : () => _submit(state),
            ),
          ),
        ],
      ),
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.identifier,
    required this.icon,
    required this.label,
    required this.onTap,
    this.onClear,
  });

  final String identifier;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: identifier,
      child: Material(
        color: AppColors.surfaceAltColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.md),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            child: Row(
              children: <Widget>[
                Icon(icon, size: 20, color: AppColors.textSecondaryColor),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: Text(label, style: Styles.s14(context))),
                if (onClear != null)
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: onClear,
                  )
                else
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondaryColor,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

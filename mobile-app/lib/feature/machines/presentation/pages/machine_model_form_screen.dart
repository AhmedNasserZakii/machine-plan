import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/data/logic/machine_model_form/machine_model_form_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_model_form/machine_model_form_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_model_form_fields.dart';

/// Adds a model to the catalogue, or corrects one. [existing] decides which.
class MachineModelFormScreen extends StatefulWidget {
  const MachineModelFormScreen({super.key, this.existing});

  final MachineModelEntity? existing;

  @override
  State<MachineModelFormScreen> createState() => _MachineModelFormScreenState();
}

class _MachineModelFormScreenState extends State<MachineModelFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _nameArController = TextEditingController();
  final TextEditingController _nameEnController = TextEditingController();
  final TextEditingController _manufacturerController = TextEditingController();

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();

    final MachineModelEntity? existing = widget.existing;
    if (existing != null) {
      _codeController.text = existing.code;
      _nameArController.text = existing.nameAr ?? existing.name;
      _nameEnController.text = existing.nameEn ?? existing.name;
      _manufacturerController.text = existing.manufacturer ?? '';
    }

    context.read<MachineModelFormCubit>().load();
  }

  @override
  void dispose() {
    _codeController.dispose();
    _nameArController.dispose();
    _nameEnController.dispose();
    _manufacturerController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final MachineModelFormState state = context.read<MachineModelFormCubit>().state;
    if (state is! MachineModelFormReady || state.selectedType == null) {
      return;
    }

    context.read<MachineModelFormCubit>().submit(
      code: _codeController.text,
      nameAr: _nameArController.text,
      nameEn: _nameEnController.text,
      manufacturer: _nullIfBlank(_manufacturerController.text),
    );
  }

  String? _nullIfBlank(String raw) {
    final String trimmed = raw.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(
          _isEditing
              ? LocaleKeys.machineModelEditTitle.tr()
              : LocaleKeys.machineModelAddTitle.tr(),
        ),
      ),
      body: BlocConsumer<MachineModelFormCubit, MachineModelFormState>(
        listener: (BuildContext context, MachineModelFormState state) {
          if (state is MachineModelFormSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          }

          if (state is MachineModelFormSubmitted) {
            showSuccessToast(
              state.wasCreated
                  ? LocaleKeys.machineModelCreated.tr()
                  : LocaleKeys.machineModelUpdated.tr(),
              context,
            );
            AppRoute.goBack(context: context, result: true);
          }
        },
        builder: (BuildContext context, MachineModelFormState state) {
          return switch (state) {
            MachineModelFormLoadFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machineModelsOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MachineModelFormCubit>().load(),
              ),
            MachineModelFormReady() => _buildForm(context, state),
            _ => const Center(child: AppLoadingIndicator()),
          };
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, MachineModelFormReady state) {
    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Form(
                key: _formKey,
                child: MachineModelFormFields(
                  state: state,
                  isEditing: _isEditing,
                  codeController: _codeController,
                  nameArController: _nameArController,
                  nameEnController: _nameEnController,
                  manufacturerController: _manufacturerController,
                  onTypeSelected: context.read<MachineModelFormCubit>().selectType,
                  onActiveChanged: context.read<MachineModelFormCubit>().setActive,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: PermissionGate(
              permission: P.settingsManage,
              child: CustomButton(
                title: LocaleKeys.save.tr(),
                isLoading: state.isSubmitting,
                identifier: 'machine_model_form_submit',
                onPressed: state.selectedType == null ? null : _submit,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

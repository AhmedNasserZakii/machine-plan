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
import 'package:machinery/feature/machines/data/logic/machine_form/machine_form_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_form/machine_form_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_form_fields.dart';

/// Registers a machine, or edits one. [existing] decides which.
class MachineFormScreen extends StatefulWidget {
  const MachineFormScreen({super.key, this.existing});

  final MachineEntity? existing;

  @override
  State<MachineFormScreen> createState() => _MachineFormScreenState();
}

class _MachineFormScreenState extends State<MachineFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _serialController = TextEditingController();
  final TextEditingController _batteryController = TextEditingController();
  final TextEditingController _simController = TextEditingController();
  final TextEditingController _boxController = TextEditingController();
  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _invoiceController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  /// Warranty dates live in the cubit because the SIM/model rules read them;
  /// the purchase date is only ever submitted, so it stays here.
  String? _purchaseDate;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();

    final MachineEntity? existing = widget.existing;
    if (existing != null) {
      _priceController.text = existing.purchase.price?.toString() ?? '';
      _invoiceController.text = existing.purchase.invoiceNo ?? '';
      _notesController.text = existing.notes ?? '';
      _purchaseDate = existing.purchase.date;
    }

    context.read<MachineFormCubit>().load();
  }

  @override
  void dispose() {
    _serialController.dispose();
    _batteryController.dispose();
    _simController.dispose();
    _boxController.dispose();
    _priceController.dispose();
    _invoiceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _submit(MachineFormReady state) {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    if (state.selectedModel == null) {
      showErrorToast(LocaleKeys.machineModelRequired.tr(), context);
      return;
    }

    context.read<MachineFormCubit>().submit(
      serial: _serialController.text.trim(),
      batterySerial: _batteryController.text.trim(),
      simSerial: _nullIfBlank(_simController.text),
      boxSerial: _nullIfBlank(_boxController.text),
      purchasePrice: double.tryParse(_priceController.text.trim()),
      purchaseDate: _purchaseDate,
      factoryInvoiceNo: _nullIfBlank(_invoiceController.text),
      notes: _nullIfBlank(_notesController.text),
    );
  }

  /// An empty box means "not recorded", not an empty string — sending `""` for
  /// an optional serial would take a unique slot nothing else could use.
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
              ? LocaleKeys.machineEditTitle.tr()
              : LocaleKeys.machineAddTitle.tr(),
        ),
      ),
      body: BlocConsumer<MachineFormCubit, MachineFormState>(
        listener: (BuildContext context, MachineFormState state) {
          if (state is MachineFormSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          }

          if (state is MachineFormSubmitted) {
            showSuccessToast(
              state.wasCreated
                  ? LocaleKeys.machineCreated.tr()
                  : LocaleKeys.machineSaved.tr(),
              context,
            );
            AppRoute.goBack(context: context, result: true);
          }
        },
        builder: (BuildContext context, MachineFormState state) {
          return switch (state) {
            MachineFormLoadFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MachineFormCubit>().load(),
              ),
            MachineFormReady() => _buildForm(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, MachineFormReady state) {
    final MachineFormCubit cubit = context.read<MachineFormCubit>();

    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Form(
                key: _formKey,
                child: MachineFormFields(
                  state: state,
                  isEditing: _isEditing,
                  serialController: _serialController,
                  batterySerialController: _batteryController,
                  simSerialController: _simController,
                  boxSerialController: _boxController,
                  priceController: _priceController,
                  invoiceController: _invoiceController,
                  notesController: _notesController,
                  purchaseDate: _purchaseDate,
                  onModelSelected: cubit.selectModel,
                  onHasBoxChanged: (bool value) =>
                      cubit.setHasBox(hasBox: value),
                  onPurchaseDatePicked: (String? date) =>
                      setState(() => _purchaseDate = date),
                  onWarrantyStartPicked: cubit.setWarrantyStart,
                  onWarrantyEndPicked: cubit.setWarrantyEnd,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: PermissionGate(
              permission: _isEditing ? P.machinesUpdate : P.machinesCreate,
              child: CustomButton(
                title: LocaleKeys.save.tr(),
                isLoading: state.isSubmitting,
                identifier: 'machine_form_submit',
                onPressed: () => _submit(state),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

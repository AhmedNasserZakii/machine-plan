import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/users/data/logic/branch_form/branch_form_cubit.dart';
import 'package:machinery/feature/users/data/logic/branch_form/branch_form_state.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/branch_active_action.dart';
import 'package:machinery/feature/users/presentation/widgets/branch_form_fields.dart';

/// Adds a branch, or edits and deactivates one. [existing] decides which.
/// Pops with true whenever the branch changed on the server.
class BranchFormScreen extends StatefulWidget {
  const BranchFormScreen({super.key, this.existing});

  final BranchEntity? existing;

  @override
  State<BranchFormScreen> createState() => _BranchFormScreenState();
}

class _BranchFormScreenState extends State<BranchFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();

    final BranchEntity? existing = widget.existing;
    if (existing != null) {
      _codeController.text = existing.code;
      _nameController.text = existing.name;
      _addressController.text = existing.address ?? '';
      _phoneController.text = existing.phone ?? '';
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _nameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    context.read<BranchFormCubit>().submit(
      code: _codeController.text,
      name: _nameController.text,
      address: _addressController.text,
      phone: _phoneController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(
          _isEditing
              ? LocaleKeys.branchEditTitle.tr()
              : LocaleKeys.branchAddTitle.tr(),
        ),
      ),
      body: BlocConsumer<BranchFormCubit, BranchFormState>(
        listener: (BuildContext context, BranchFormState state) {
          if (state is BranchFormSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          }

          if (state is BranchFormSubmitted) {
            showSuccessToast(
              state.wasCreated
                  ? LocaleKeys.branchCreated.tr()
                  : LocaleKeys.branchUpdated.tr(),
              context,
            );
            AppRoute.goBack(context: context, result: true);
          }

          if (state is BranchFormActiveChanged) {
            showSuccessToast(
              state.branch.isActive
                  ? LocaleKeys.branchActivated.tr()
                  : LocaleKeys.branchDeactivated.tr(),
              context,
            );
            AppRoute.goBack(context: context, result: true);
          }
        },
        buildWhen: (_, BranchFormState current) => current is BranchFormReady,
        builder: (BuildContext context, BranchFormState state) {
          final BranchFormReady ready = state is BranchFormReady
              ? state
              : const BranchFormReady();

          return _buildForm(context, ready);
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, BranchFormReady state) {
    final BranchEntity? existing = widget.existing;

    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Form(
                key: _formKey,
                child: BranchFormFields(
                  state: state,
                  isEditing: _isEditing,
                  codeController: _codeController,
                  nameController: _nameController,
                  addressController: _addressController,
                  phoneController: _phoneController,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                CustomButton(
                  title: LocaleKeys.save.tr(),
                  isLoading: state.isSubmitting,
                  identifier: 'branch_form_submit',
                  onPressed: state.isBusy ? null : _submit,
                ),
                if (existing != null) ...<Widget>[
                  const SizedBox(height: AppSpacing.sm),
                  BranchActiveAction(branch: existing, state: state),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

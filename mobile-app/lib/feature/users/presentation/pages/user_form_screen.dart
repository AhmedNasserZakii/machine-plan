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
import 'package:machinery/feature/users/data/logic/user_form/user_form_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_form/user_form_state.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/user_form_actions.dart';
import 'package:machinery/feature/users/presentation/widgets/user_form_fields.dart';

/// Creates an account, or edits one. Which of the two is decided by [existing]
/// rather than by a mode flag.
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({super.key, this.existing});

  final UserEntity? existing;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();

    final UserEntity? existing = widget.existing;
    if (existing != null) {
      _nameController.text = existing.fullName;
      _phoneController.text = existing.phone;
      _emailController.text = existing.email ?? '';
    }

    context.read<UserFormCubit>().load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit(UserFormReady state) {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    // A branch-scoped role without a branch would be rejected by the server
    // with a field error; catching it here keeps the round trip out of it.
    if (state.requiresBranch && state.selectedBranchId == null) {
      showErrorToast(LocaleKeys.userPickBranch.tr(), context);
      return;
    }

    if (state.selectedRole == null) {
      showErrorToast(LocaleKeys.userPickRole.tr(), context);
      return;
    }

    context.read<UserFormCubit>().submit(
          fullName: _nameController.text,
          phone: _phoneController.text,
          email: _emailController.text,
          password: _passwordController.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(
          _isEditing ? LocaleKeys.userEdit.tr() : LocaleKeys.userAdd.tr(),
        ),
      ),
      body: BlocConsumer<UserFormCubit, UserFormState>(
        listener: (BuildContext context, UserFormState state) {
          if (state is UserFormSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          }

          if (state is UserFormSubmitted) {
            showSuccessToast(
              state.wasCreated
                  ? LocaleKeys.userCreated.tr()
                  : LocaleKeys.userUpdated.tr(),
              context,
            );
            AppRoute.goBack(context: context, result: true);
          }
        },
        builder: (BuildContext context, UserFormState state) {
          return switch (state) {
            UserFormLoadFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.usersOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<UserFormCubit>().load(),
              ),
            UserFormReady() => _buildForm(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, UserFormReady state) {
    final UserFormCubit cubit = context.read<UserFormCubit>();
    final UserEntity? existing = widget.existing;

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
                    UserFormFields(
                      state: state,
                      nameController: _nameController,
                      phoneController: _phoneController,
                      emailController: _emailController,
                      passwordController: _passwordController,
                      isEditing: _isEditing,
                      onRoleChanged: (RoleEntity role) =>
                          cubit.selectRole(role),
                      onBranchChanged: cubit.selectBranch,
                    ),
                    if (existing != null) ...<Widget>[
                      const SizedBox(height: AppSpacing.lg),
                      UserFormActions(user: existing),
                    ],
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: PermissionGate(
              permission: _isEditing ? P.usersUpdate : P.usersCreate,
              child: CustomButton(
                title: LocaleKeys.save.tr(),
                isLoading: state.isSubmitting,
                identifier: 'user_form_submit',
                onPressed: () => _submit(state),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

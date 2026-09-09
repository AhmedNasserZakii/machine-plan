import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/change_password/change_password_cubit.dart';
import 'package:machinery/feature/auth/data/logic/change_password/change_password_state.dart';
import 'package:machinery/feature/auth/presentation/widgets/change_password_form.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({required this.isForced, super.key});

  /// When the server says `mustChangePassword`, there is no back button and no
  /// skip — the user cannot reach the rest of the app until this is done.
  final bool isForced;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final TextEditingController _currentPasswordController =
      TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  bool get _isSubmitEnabled {
    return AppValidators.isValidPassword(_currentPasswordController.text) ==
            null &&
        AppValidators.isValidPassword(_newPasswordController.text) == null &&
        AppValidators.isValidConfirmPassword(
              _newPasswordController.text,
              _confirmPasswordController.text,
            ) ==
            null;
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _onFormChanged() => setState(() {});

  void _onSubmitPressed() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    context.read<ChangePasswordCubit>().changePassword(
      currentPassword: _currentPasswordController.text,
      newPassword: _newPasswordController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !widget.isForced,
      child: BlocConsumer<ChangePasswordCubit, ChangePasswordState>(
        listener: (context, state) {
          if (state is ChangePasswordFailure) {
            showErrorToast(state.errorMessage, context);
          }
          if (state is ChangePasswordSuccess) {
            showSuccessToast(
              LocaleKeys.changePasswordSuccessMessage.tr(),
              context,
            );
            if (widget.isForced) {
              AppRoute.goToMainScaffold(context: context);
            } else {
              AppRoute.goBack(context: context);
            }
          }
        },
        builder: (context, state) {
          final bool isLoading = state is ChangePasswordLoading;
          final Map<String, String> fieldErrors = state is ChangePasswordFailure
              ? state.fieldErrors
              : const <String, String>{};

          return Scaffold(
            appBar: AppBar(
              title: Text(LocaleKeys.changePassword.tr()),
              automaticallyImplyLeading: !widget.isForced,
            ),
            body: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      if (widget.isForced) ...<Widget>[
                        Text(
                          LocaleKeys.changePasswordRequiredTitle.tr(),
                          style: Styles.s20(context),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          LocaleKeys.changePasswordRequiredSubtitle.tr(),
                          style: Styles.s14(
                            context,
                          ).copyWith(color: AppColors.textSecondaryColor),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                      ChangePasswordForm(
                        currentPasswordController: _currentPasswordController,
                        newPasswordController: _newPasswordController,
                        confirmPasswordController: _confirmPasswordController,
                        fieldErrors: fieldErrors,
                        onChanged: _onFormChanged,
                        onSubmitted: _onSubmitPressed,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      CustomButton(
                        title: LocaleKeys.save.tr(),
                        isLoading: isLoading,
                        onPressed: _isSubmitEnabled ? _onSubmitPressed : null,
                        identifier: 'change_password_submit_button',
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

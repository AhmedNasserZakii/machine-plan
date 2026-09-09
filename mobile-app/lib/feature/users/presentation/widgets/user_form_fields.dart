// `easy_localization` exports its own `TextDirection`, which collides with the
// Flutter one the fields need.
import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/data/logic/user_form/user_form_state.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/branch_selector.dart';
import 'package:machinery/feature/users/presentation/widgets/role_selector.dart';

/// The whole create/edit form body.
///
/// The branch selector is added and removed with the role rather than being
/// disabled: a Director has no branch, and a field they can never fill is a
/// question with no right answer.
class UserFormFields extends StatelessWidget {
  const UserFormFields({
    required this.state,
    required this.nameController,
    required this.phoneController,
    required this.emailController,
    required this.passwordController,
    required this.isEditing,
    required this.onRoleChanged,
    required this.onBranchChanged,
    super.key,
  });

  final UserFormReady state;
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool isEditing;
  final ValueChanged<RoleEntity> onRoleChanged;
  final ValueChanged<String> onBranchChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        LabeledTextFormField(
          controller: nameController,
          label: LocaleKeys.userFullName.tr(),
          hintText: LocaleKeys.userFullName.tr(),
          keyboardType: TextInputType.name,
          textInputAction: TextInputAction.next,
          identifier: 'user_name_field',
          errorText: state.fieldErrors['fullName'],
          validation: AppValidators.isNotEmptyValidator,
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          controller: phoneController,
          label: LocaleKeys.userPhone.tr(),
          hintText: '01xxxxxxxxx',
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.next,
          identifier: 'user_phone_field',
          textDirection: TextDirection.ltr,
          maxLength: 11,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
          ],
          errorText: state.fieldErrors['phone'],
          validation: AppValidators.isValidEgyptianPhone,
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          controller: emailController,
          label: LocaleKeys.userEmailOptional.tr(),
          hintText: LocaleKeys.userEmail.tr(),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          identifier: 'user_email_field',
          textDirection: TextDirection.ltr,
          errorText: state.fieldErrors['email'],
        ),
        const SizedBox(height: AppSpacing.md),

        RoleSelector(
          roles: state.roles,
          selected: state.selectedRole,
          errorText: state.fieldErrors['roleId'],
          onChanged: onRoleChanged,
        ),
        const SizedBox(height: AppSpacing.md),

        if (state.requiresBranch) ...<Widget>[
          BranchSelector(
            branches: state.branches,
            selectedId: state.selectedBranchId,
            errorText: state.fieldErrors['branchId'],
            onChanged: onBranchChanged,
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        // A password is only set at creation. Changing an existing one goes
        // through reset, which is a deliberate, separate action.
        if (!isEditing) ...<Widget>[
          LabeledTextFormField(
            controller: passwordController,
            label: LocaleKeys.userInitialPassword.tr(),
            hintText: LocaleKeys.userInitialPassword.tr(),
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.done,
            identifier: 'user_password_field',
            isPassword: true,
            errorText: state.fieldErrors['password'],
            validation: AppValidators.isValidPassword,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LocaleKeys.userInitialPasswordHint.tr(),
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ],
      ],
    );
  }
}

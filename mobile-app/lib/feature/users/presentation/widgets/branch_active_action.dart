import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/feature/users/data/logic/branch_form/branch_form_cubit.dart';
import 'package:machinery/feature/users/data/logic/branch_form/branch_form_state.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// Deactivate or restore an existing branch. There is no hard delete: staff,
/// machines and history all point at the branch row.
class BranchActiveAction extends StatelessWidget {
  const BranchActiveAction({
    required this.branch,
    required this.state,
    super.key,
  });

  final BranchEntity branch;
  final BranchFormReady state;

  Future<void> _onPressed(BuildContext context) async {
    if (!branch.isActive) {
      await context.read<BranchFormCubit>().setActive(isActive: true);
      return;
    }

    final bool confirmed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.branchDeactivateTitle.tr(),
      description: LocaleKeys.branchDeactivateMessage.tr(
        args: <String>[branch.name],
      ),
      confirmLabel: LocaleKeys.branchDeactivate.tr(),
      isDestructive: true,
      icon: Icons.block_outlined,
      confirmIdentifier: 'branch_deactivate_confirm',
      cancelIdentifier: 'branch_deactivate_cancel',
    );

    if (confirmed && context.mounted) {
      await context.read<BranchFormCubit>().setActive(isActive: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isActive = branch.isActive;

    return CustomButton(
      title: isActive
          ? LocaleKeys.branchDeactivate.tr()
          : LocaleKeys.branchActivate.tr(),
      isLoading: state.isTogglingActive,
      backgroundColor: isActive
          ? AppColors.dangerColor
          : AppColors.successColor,
      foregroundColor: AppColors.textOnPrimaryColor,
      identifier: 'branch_form_set_active',
      onPressed: state.isBusy ? null : () => _onPressed(context),
    );
  }
}

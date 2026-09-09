import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/scanning/domain/entities/scan_decision.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_details_step.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_machines_step.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_review_step.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_type_step.dart';
import 'package:machinery/feature/transfers/presentation/widgets/wizard_progress.dart';

/// The four-step create wizard: type, machines, details, review.
///
/// Split into steps because a hand-off of forty machines is not one form. Each
/// step is something a person finishes before moving on, which is also where
/// the dry run fits — between the details and the review, so a hand-off that
/// cannot go through is refused before anyone signs for it.
class CreateTransferScreen extends StatefulWidget {
  const CreateTransferScreen({super.key});

  @override
  State<CreateTransferScreen> createState() => _CreateTransferScreenState();
}

class _CreateTransferScreenState extends State<CreateTransferScreen> {
  @override
  void initState() {
    super.initState();
    context.read<CreateTransferCubit>().loadTypes();
  }

  /// Machines are added by scan, one after another without the camera
  /// closing (`8.2`) — a hand-off of forty machines is not forty trips
  /// through the scanner screen. A hit that is not eligible for this type is
  /// said so plainly, in place, rather than added and refused later.
  Future<void> _scan() async {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();

    await AppRoute.goToContinuousScanner(
      context: context,
      onHit: (MachineLookupResult result) async {
        final CreateTransferState state = cubit.state;

        if (state.items.any(
          (DraftItem item) => item.machine.id == result.machine.id,
        )) {
          return ScanDecision.reject(
            LocaleKeys.transferMachineAlreadyAdded.tr(),
          );
        }

        if (!state.isEligible(result.machine)) {
          return ScanDecision.reject(
            LocaleKeys.transferMachineNotEligible.tr(),
          );
        }

        cubit.addMachine(result.machine);
        return const ScanDecision.accept();
      },
    );
  }

  void _onStateChanged(BuildContext context, CreateTransferState state) {
    if (state.created != null) {
      Navigator.of(context).pop(true);
      return;
    }

    if (state.errorMessage != null) {
      showErrorToast(state.errorMessage!, context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CreateTransferCubit, CreateTransferState>(
      listener: _onStateChanged,
      builder: (BuildContext context, CreateTransferState state) {
        return Scaffold(
          appBar: AppBar(
            title: Text(LocaleKeys.transferCreateTitle.tr()),
            leading: state.step == CreateTransferStep.typeAndRecipient
                ? null
                : IconButton(
                    onPressed: context.read<CreateTransferCubit>().back,
                    icon: const Icon(Icons.arrow_forward_rounded),
                  ),
          ),
          body: Column(
            children: <Widget>[
              WizardProgress(step: state.step),
              Expanded(child: _buildStep(state)),
              _buildFooter(context, state),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStep(CreateTransferState state) => switch (state.step) {
    CreateTransferStep.typeAndRecipient => TransferTypeStep(state: state),
    CreateTransferStep.pickMachines => TransferMachinesStep(
      state: state,
      onScan: _scan,
    ),
    CreateTransferStep.itemDetails => TransferDetailsStep(state: state),
    CreateTransferStep.review => TransferReviewStep(state: state),
  };

  Widget _buildFooter(BuildContext context, CreateTransferState state) {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();

    final (
      String label,
      VoidCallback? action,
      bool isBusy,
    ) = switch (state.step) {
      CreateTransferStep.typeAndRecipient => (
        LocaleKeys.next.tr(),
        state.canLeaveTypeStep
            ? () => cubit.goTo(CreateTransferStep.pickMachines)
            : null,
        false,
      ),
      CreateTransferStep.pickMachines => (
        LocaleKeys.next.tr(),
        state.canLeaveMachinesStep
            ? () => cubit.goTo(CreateTransferStep.itemDetails)
            : null,
        false,
      ),
      // The dry run happens here, on the way into the review.
      CreateTransferStep.itemDetails => (
        LocaleKeys.next.tr(),
        cubit.validateAndReview,
        state.isValidating,
      ),
      CreateTransferStep.review => (
        LocaleKeys.transferSubmit.tr(),
        cubit.submit,
        state.isSubmitting,
      ),
    };

    return SafeArea(
      child: Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: const BoxDecoration(
          color: AppColors.surfaceColor,
          border: Border(top: BorderSide(color: AppColors.borderColor)),
        ),
        child: CustomButton(
          title: label,
          isLoading: isBusy,
          height: 48,
          width: double.infinity,
          identifier: 'transfer_wizard_next',
          onPressed: isBusy ? null : action,
        ),
      ),
    );
  }
}

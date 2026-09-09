import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/theme/styles/status_colors.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/violations/data/logic/violation_detail/violation_detail_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violation_detail/violation_detail_state.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';
import 'package:machinery/feature/violations/presentation/helpers/violation_labels.dart';
import 'package:machinery/feature/violations/presentation/widgets/charge_violation_sheet.dart';
import 'package:machinery/feature/violations/presentation/widgets/waive_violation_sheet.dart';

/// One violation, and the three things that can be done to it: seen, charged,
/// let go.
class ViolationDetailScreen extends StatefulWidget {
  const ViolationDetailScreen({super.key});

  @override
  State<ViolationDetailScreen> createState() => _ViolationDetailScreenState();
}

class _ViolationDetailScreenState extends State<ViolationDetailScreen> {
  /// The row handed back to the list on the way out, so it can swap it in place
  /// instead of refetching the whole page. Null means nothing changed.
  ViolationEntity? _updated;

  @override
  void initState() {
    super.initState();
    context.read<ViolationDetailCubit>().load();
  }

  Future<void> _charge() async {
    final ChargeViolationParams? params = await ChargeViolationSheet.show(
      context,
    );

    if (params == null || !mounted) {
      return;
    }

    await context.read<ViolationDetailCubit>().charge(params);
  }

  Future<void> _waive() async {
    final WaiveViolationParams? params = await WaiveViolationSheet.show(
      context,
    );

    if (params == null || !mounted) {
      return;
    }

    await context.read<ViolationDetailCubit>().waive(params);
  }

  /// Actions report through the cubit's two one-shot fields rather than through
  /// the state, so a rebuild cannot re-fire a toast.
  void _announce(BuildContext context, ViolationDetailState state) {
    final ViolationDetailCubit cubit = context.read<ViolationDetailCubit>();

    final String? error = cubit.lastError;
    if (error != null) {
      cubit.lastError = null;
      showErrorToast(error, context);
      return;
    }

    final ViolationActionOutcome? outcome = cubit.lastOutcome;
    if (outcome == null) {
      return;
    }

    cubit.lastOutcome = null;

    if (state is ViolationDetailLoaded) {
      _updated = state.violation;
    }

    showSuccessToast(switch (outcome) {
      ViolationActionOutcome.acknowledged =>
        LocaleKeys.violationAcknowledged.tr(),
      ViolationActionOutcome.charged => LocaleKeys.violationChargeDone.tr(),
      ViolationActionOutcome.waived => LocaleKeys.violationWaiveDone.tr(),
    }, context);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (!didPop) {
          AppRoute.goBack(context: context, result: _updated);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: const ArrowBackWidget(),
          title: Text(LocaleKeys.violationDetailsTitle.tr()),
        ),
        body: BlocConsumer<ViolationDetailCubit, ViolationDetailState>(
          listenWhen:
              (ViolationDetailState previous, ViolationDetailState next) {
                return previous is ViolationDetailLoaded &&
                    next is ViolationDetailLoaded &&
                    previous.actionInProgress &&
                    !next.actionInProgress;
              },
          listener: _announce,
          builder: (BuildContext context, ViolationDetailState state) {
            return switch (state) {
              ViolationDetailFailure(
                :final String errorMessage,
                :final bool isOffline,
              ) =>
                AppErrorView(
                  message: isOffline
                      ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                      : errorMessage,
                  onRetry: () => context.read<ViolationDetailCubit>().load(),
                ),
              ViolationDetailLoaded() => _buildBody(context, state),
              ViolationDetailLoading() => const AppLoadingIndicator(),
            };
          },
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, ViolationDetailLoaded state) {
    final ViolationEntity violation = state.violation;

    return ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: <Widget>[
        _Header(violation: violation),
        const SizedBox(height: AppSpacing.md),

        _FactsCard(violation: violation),
        const SizedBox(height: AppSpacing.md),

        if (violation.isSettled)
          _OutcomeCard(violation: violation)
        else
          _Actions(
            violation: violation,
            isBusy: state.actionInProgress,
            onAcknowledge: context.read<ViolationDetailCubit>().acknowledge,
            onCharge: _charge,
            onWaive: _waive,
          ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.violation});

  final ViolationEntity violation;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  violation.type.name,
                  style: Styles.s20(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              StatusChip(
                label: ViolationLabels.status(violation.status),
                color: ViolationLabels.statusColor(violation.status),
                icon: ViolationLabels.statusIcon(violation.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          StatusChip(
            label: ViolationLabels.severity(violation.severity),
            color: StatusColors.forViolationSeverity(violation.severity),
            icon: StatusColors.iconForViolationSeverity(violation.severity),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(violation.description, style: Styles.s14(context)),
        ],
      ),
    );
  }
}

class _FactsCard extends StatelessWidget {
  const _FactsCard({required this.violation});

  final ViolationEntity violation;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.violationDetailsTitle.tr(),
      icon: Icons.info_outline_rounded,
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.violationAgainst.tr(),
          value: violation.user.fullName,
        ),
        DetailRow(
          label: LocaleKeys.violationMachine.tr(),
          valueWidget: violation.machine == null
              ? null
              : LtrText(
                  violation.machine!.serial,
                  style: Styles.s14(
                    context,
                  ).copyWith(fontWeight: FontWeight.w500),
                ),
        ),
        DetailRow(
          label: LocaleKeys.violationRaisedOn.tr(),
          value: violation.createdAt == null
              ? null
              : Formatters.dateTime(violation.createdAt!),
        ),
        DetailRow(
          label: LocaleKeys.violationAcknowledgedOn.tr(),
          value: violation.acknowledgedAt == null
              ? null
              : Formatters.dateTime(violation.acknowledgedAt!),
        ),
        if (violation.autoGenerated)
          DetailNote(
            LocaleKeys.violationAutoLocked.tr(),
            icon: Icons.auto_awesome_outlined,
          ),
      ],
    );
  }
}

/// What happened in the end. Replaces the action row entirely, because a
/// settled violation has nothing left to do to it.
class _OutcomeCard extends StatelessWidget {
  const _OutcomeCard({required this.violation});

  final ViolationEntity violation;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: ViolationLabels.status(violation.status),
      icon: ViolationLabels.statusIcon(violation.status),
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.violationChargedAmount.tr(),
          valueWidget: violation.chargedAmount == null
              ? null
              : LtrText(
                  Formatters.currency(violation.chargedAmount!),
                  style: Styles.s14(context).copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.successColor,
                  ),
                ),
        ),
        DetailRow(
          label: LocaleKeys.violationChargedOn.tr(),
          value: violation.chargedAt == null
              ? null
              : Formatters.dateTime(violation.chargedAt!),
        ),
        DetailRow(
          label: LocaleKeys.violationWaiverReason.tr(),
          value: violation.waiverReason,
        ),
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.violation,
    required this.isBusy,
    required this.onAcknowledge,
    required this.onCharge,
    required this.onWaive,
  });

  final ViolationEntity violation;
  final bool isBusy;
  final VoidCallback onAcknowledge;
  final VoidCallback onCharge;
  final VoidCallback onWaive;

  /// Acknowledgement is the subject's own statement, so it is offered only to
  /// him. Read the same way `UserFormActions` answers "is this me".
  String? get _currentUserId {
    final AuthState state = getIt<AuthCubit>().state;
    return state is Authenticated ? state.profile.user.id : null;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (violation.canAcknowledgeBy(_currentUserId)) ...<Widget>[
          OutlinedButton.icon(
            onPressed: isBusy ? null : onAcknowledge,
            icon: const Icon(Icons.visibility_outlined),
            label: Semantics(
              identifier: 'violation_acknowledge_button',
              child: Text(LocaleKeys.violationAcknowledge.tr()),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          DetailNote(LocaleKeys.violationAcknowledgeHint.tr()),
          const SizedBox(height: AppSpacing.md),
        ],

        // Charging writes a finance transaction as well as closing the row, so
        // it follows `violations.resolve` — the permission that carries the
        // authority to put a cost on someone.
        PermissionGate(
          permission: P.violationsResolve,
          child: FilledButton.icon(
            onPressed: isBusy ? null : onCharge,
            icon: const Icon(Icons.payments_outlined),
            label: Semantics(
              identifier: 'violation_charge_button',
              child: Text(LocaleKeys.violationCharge.tr()),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        PermissionGate(
          permission: P.violationsWaive,
          child: OutlinedButton.icon(
            onPressed: isBusy ? null : onWaive,
            icon: const Icon(Icons.do_not_disturb_on_outlined),
            label: Semantics(
              identifier: 'violation_waive_button',
              child: Text(LocaleKeys.violationWaive.tr()),
            ),
          ),
        ),
      ],
    );
  }
}

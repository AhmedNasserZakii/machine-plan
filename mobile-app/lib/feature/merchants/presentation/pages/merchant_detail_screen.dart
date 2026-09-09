import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_card.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_detail/merchant_detail_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_detail/merchant_detail_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';
import 'package:machinery/feature/merchants/presentation/widgets/collect_subscription_sheet.dart';
import 'package:machinery/feature/merchants/presentation/widgets/merchant_detail_header.dart';
import 'package:machinery/feature/merchants/presentation/widgets/merchant_timeline_card.dart';
import 'package:machinery/feature/merchants/presentation/widgets/subscription_form_sheet.dart';
import 'package:machinery/feature/merchants/presentation/widgets/subscription_tile.dart';

/// Everything about one shop: who he is, what he holds, what he pays, and every
/// hand-off and collection that ever touched him.
class MerchantDetailScreen extends StatefulWidget {
  const MerchantDetailScreen({super.key});

  @override
  State<MerchantDetailScreen> createState() => _MerchantDetailScreenState();
}

class _MerchantDetailScreenState extends State<MerchantDetailScreen> {
  /// What the list behind this screen is told on the way out, so it only
  /// refreshes when something actually changed.
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    context.read<MerchantDetailCubit>().load();
  }

  Future<void> _edit(MerchantEntity merchant) async {
    final bool? saved = await AppRoute.goToMerchantForm(
      context: context,
      existing: merchant,
    );

    if ((saved ?? false) && mounted) {
      _changed = true;
      await context.read<MerchantDetailCubit>().load();
    }
  }

  Future<void> _addSubscription(List<MachineEntity> machines) async {
    final CreateSubscriptionParams? params = await SubscriptionFormSheet.show(
      context: context,
      machines: machines,
    );

    if (params == null || !mounted) {
      return;
    }

    await context.read<MerchantDetailCubit>().createSubscription(params);
  }

  Future<void> _collect(SubscriptionEntity subscription) async {
    final CollectSubscriptionParams? params =
        await CollectSubscriptionSheet.show(
          context: context,
          subscription: subscription,
        );

    if (params == null || !mounted) {
      return;
    }

    await context.read<MerchantDetailCubit>().collect(subscription.id, params);
  }

  Future<void> _deactivate() async {
    final bool confirmed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.merchantDeactivate.tr(),
      description: LocaleKeys.merchantDeactivateConfirm.tr(),
      confirmLabel: LocaleKeys.merchantDeactivate.tr(),
      confirmIdentifier: 'merchant_deactivate_confirm',
      isDestructive: true,
    );

    if (!confirmed || !mounted) {
      return;
    }

    await context.read<MerchantDetailCubit>().deactivate();
  }

  /// Every action reports through the cubit's two one-shot fields rather than
  /// through the state, so a rebuild cannot re-fire a toast.
  void _announce(BuildContext context, MerchantDetailCubit cubit) {
    final String? error = cubit.lastError;
    if (error != null) {
      cubit.lastError = null;
      showErrorToast(error, context);
      return;
    }

    final MerchantActionOutcome? outcome = cubit.lastOutcome;
    if (outcome == null) {
      return;
    }

    cubit.lastOutcome = null;
    _changed = true;

    showSuccessToast(switch (outcome) {
      MerchantActionOutcome.collected =>
        LocaleKeys.subscriptionCollectDone.tr(),
      MerchantActionOutcome.subscribed => LocaleKeys.subscriptionCreated.tr(),
      MerchantActionOutcome.deactivated => LocaleKeys.merchantDeactivated.tr(),
    }, context);

    // Closing a merchant out ends the screen: there is nothing left to do here.
    if (outcome == MerchantActionOutcome.deactivated) {
      AppRoute.goBack(context: context, result: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (!didPop) {
          AppRoute.goBack(context: context, result: _changed);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: const ArrowBackWidget(),
          title: Text(LocaleKeys.merchantDetailsTitle.tr()),
        ),
        body: BlocConsumer<MerchantDetailCubit, MerchantDetailState>(
          listenWhen: (MerchantDetailState previous, MerchantDetailState next) {
            return previous is MerchantDetailLoaded &&
                next is MerchantDetailLoaded &&
                previous.actionInProgress &&
                !next.actionInProgress;
          },
          listener: (BuildContext context, MerchantDetailState state) {
            _announce(context, context.read<MerchantDetailCubit>());
          },
          builder: (BuildContext context, MerchantDetailState state) {
            return switch (state) {
              MerchantDetailFailure(
                :final String errorMessage,
                :final bool isOffline,
              ) =>
                AppErrorView(
                  message: isOffline
                      ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                      : errorMessage,
                  onRetry: () => context.read<MerchantDetailCubit>().load(),
                ),
              MerchantDetailLoaded() => _buildBody(context, state),
              MerchantDetailLoading() => const AppLoadingIndicator(),
            };
          },
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, MerchantDetailLoaded state) {
    final MerchantDetail detail = state.detail;
    final MerchantEntity merchant = detail.merchant;

    return RefreshIndicator(
      onRefresh: () => context.read<MerchantDetailCubit>().load(),
      child: ListView(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        children: <Widget>[
          MerchantDetailHeader(merchant: merchant),
          const SizedBox(height: AppSpacing.md),

          _RecordCard(merchant: merchant),
          const SizedBox(height: AppSpacing.md),

          _MachinesCard(machines: detail.machines),
          const SizedBox(height: AppSpacing.md),

          _SubscriptionsCard(
            subscriptions: detail.subscriptions,
            canAdd: merchant.isActive,
            onAdd: () => _addSubscription(detail.machines),
            onCollect: _collect,
          ),
          const SizedBox(height: AppSpacing.md),

          MerchantTimelineCard(entries: detail.timeline),
          const SizedBox(height: AppSpacing.md),

          if (merchant.isActive) _Actions(merchant: merchant, screen: this),
        ],
      ),
    );
  }
}

/// The paperwork half: the national ID, who registered him and when.
class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.merchant});

  final MerchantEntity merchant;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.merchantDetailsTitle.tr(),
      icon: Icons.badge_outlined,
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.merchantNationalId.tr(),
          value: merchant.nationalId,
        ),
        DetailRow(
          label: LocaleKeys.merchantsFilterBranch.tr(),
          value: merchant.branch?.name,
        ),
        DetailRow(
          label: LocaleKeys.merchantRegisteredBy.tr(),
          value: merchant.registeredBy?.fullName,
        ),
        DetailRow(
          label: LocaleKeys.merchantRegisteredOn.tr(),
          value: merchant.createdAt == null
              ? null
              : Formatters.date(merchant.createdAt!),
        ),
        DetailRow(label: LocaleKeys.merchantNotes.tr(), value: merchant.notes),
        if (!merchant.isActive)
          DetailNote(
            LocaleKeys.merchantInactive.tr(),
            icon: Icons.block_outlined,
            color: AppColors.neutralColor,
          ),
      ],
    );
  }
}

class _MachinesCard extends StatelessWidget {
  const _MachinesCard({required this.machines});

  final List<MachineEntity> machines;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.merchantMachinesCard.tr(),
      icon: Icons.point_of_sale_outlined,
      children: machines.isEmpty
          ? <Widget>[DetailNote(LocaleKeys.merchantMachinesEmpty.tr())]
          : machines
                .map(
                  (MachineEntity machine) => Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: AppSpacing.sm,
                    ),
                    child: MachineCard(
                      machine: machine,
                      onTap: () => AppRoute.goToMachineDetail(
                        context: context,
                        machineId: machine.id,
                        initial: machine,
                      ),
                    ),
                  ),
                )
                .toList(growable: false),
    );
  }
}

class _SubscriptionsCard extends StatelessWidget {
  const _SubscriptionsCard({
    required this.subscriptions,
    required this.canAdd,
    required this.onAdd,
    required this.onCollect,
  });

  final List<SubscriptionEntity> subscriptions;
  final bool canAdd;
  final VoidCallback onAdd;
  final ValueChanged<SubscriptionEntity> onCollect;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.merchantSubscriptionsCard.tr(),
      icon: Icons.event_repeat_rounded,
      trailing: canAdd
          ? PermissionGate(
              permission: P.merchantsUpdate,
              child: IconButton(
                onPressed: onAdd,
                icon: Semantics(
                  identifier: 'subscription_add_button',
                  child: const Icon(Icons.add_rounded),
                ),
                tooltip: LocaleKeys.subscriptionAdd.tr(),
              ),
            )
          : null,
      children: subscriptions.isEmpty
          ? <Widget>[DetailNote(LocaleKeys.merchantSubscriptionsEmpty.tr())]
          : subscriptions
                .map(
                  (SubscriptionEntity subscription) => _CollectableTile(
                    subscription: subscription,
                    onCollect: () => onCollect(subscription),
                  ),
                )
                .toList(growable: false),
    );
  }
}

/// Taking money is a finance write, not a merchant edit, so the button follows
/// `finance.create` rather than the permission that opened this screen.
class _CollectableTile extends StatelessWidget {
  const _CollectableTile({required this.subscription, required this.onCollect});

  final SubscriptionEntity subscription;
  final VoidCallback onCollect;

  @override
  Widget build(BuildContext context) {
    if (!subscription.isCollectable) {
      return SubscriptionTile(subscription: subscription, onCollect: null);
    }

    return PermissionGate(
      permission: P.financeCreate,
      fallback: SubscriptionTile(subscription: subscription, onCollect: null),
      child: SubscriptionTile(subscription: subscription, onCollect: onCollect),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({required this.merchant, required this.screen});

  final MerchantEntity merchant;
  final _MerchantDetailScreenState screen;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        PermissionGate(
          permission: P.merchantsUpdate,
          child: OutlinedButton.icon(
            onPressed: () => screen._edit(merchant),
            icon: const Icon(Icons.edit_outlined),
            label: Text(LocaleKeys.merchantEditTitle.tr()),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        PermissionGate(
          permission: P.merchantsDelete,
          child: Column(
            children: <Widget>[
              OutlinedButton.icon(
                // The machines have to come back through a hand-off first, so
                // the button is down rather than left to fail with a 409.
                onPressed: merchant.canDeactivate ? screen._deactivate : null,
                icon: const Icon(Icons.block_outlined),
                label: Text(LocaleKeys.merchantDeactivate.tr()),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.dangerColor,
                ),
              ),
              if (!merchant.canDeactivate)
                Padding(
                  padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
                  child: DetailNote(
                    LocaleKeys.merchantDeactivateBlocked.tr(),
                    color: AppColors.warningColor,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

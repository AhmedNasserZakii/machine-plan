import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/transfers/data/logic/transfers_list/transfers_list_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/transfers_list/transfers_list_state.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_card.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfers_scope_tabs.dart';

/// The hand-off ledger. Opens on the inbox, because the thing a person needs
/// from this screen most days is "what am I supposed to sign for".
class TransfersListScreen extends StatefulWidget {
  const TransfersListScreen({super.key});

  @override
  State<TransfersListScreen> createState() => _TransfersListScreenState();
}

class _TransfersListScreenState extends State<TransfersListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<TransfersListCubit>().load(
      params: const TransfersQueryParams(scope: TransfersScope.incoming),
    );
  }

  Future<void> _openDetail(TransferEntity transfer) async {
    final bool? changed = await AppRoute.goToTransferDetail(
      context: context,
      transferId: transfer.id,
      initial: transfer,
    );

    if ((changed ?? false) && mounted) {
      await context.read<TransfersListCubit>().load(showLoader: false);
    }
  }

  Future<void> _openCreate() async {
    final bool? created = await AppRoute.goToCreateTransfer(context);

    if ((created ?? false) && mounted) {
      await context.read<TransfersListCubit>().selectScope(
        TransfersScope.outgoing,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(LocaleKeys.transfersTitle.tr())),
      floatingActionButton: PermissionGate(
        permission: P.transfersCreate,
        child: FloatingActionButton(
          heroTag: 'transfers_add_fab',
          onPressed: _openCreate,
          child: Semantics(
            identifier: 'transfers_add_button',
            child: const Icon(Icons.add_rounded),
          ),
        ),
      ),
      body: BlocBuilder<TransfersListCubit, TransfersListState>(
        builder: (BuildContext context, TransfersListState state) {
          return switch (state) {
            TransfersListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.transfersOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<TransfersListCubit>().load(),
              ),
            TransfersListLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildList(BuildContext context, TransfersListLoaded state) {
    final TransfersListCubit cubit = context.read<TransfersListCubit>();
    final TransfersScope scope = state.query.scope;

    return Column(
      children: <Widget>[
        const SizedBox(height: AppSpacing.sm),
        TransfersScopeTabs(
          selected: scope,
          incomingCount: state.incomingCount,
          onSelected: cubit.selectScope,
        ),
        const SizedBox(height: AppSpacing.sm),
        Expanded(
          child: PaginatedListView<TransferEntity>(
            items: state.transfers,
            hasNext: state.hasNext,
            isLoadingMore: state.isLoadingMore,
            onRefresh: () => cubit.load(showLoader: false),
            onLoadMore: cubit.loadMore,
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            emptyState: AppEmptyState(
              icon: Icons.swap_horiz_rounded,
              title: _emptyTitle(scope),
              subtitle: _emptySubtitle(scope),
            ),
            itemBuilder:
                (BuildContext context, TransferEntity transfer, int index) {
                  return TransferCard(
                    transfer: transfer,
                    // Only the inbox knows a row is the user's to act on. On
                    // the other tabs a pending transfer is somebody else's job.
                    awaitingYou:
                        scope == TransfersScope.incoming && transfer.isPending,
                    onTap: () => _openDetail(transfer),
                  );
                },
          ),
        ),
      ],
    );
  }

  String _emptyTitle(TransfersScope scope) => switch (scope) {
    TransfersScope.incoming => LocaleKeys.transfersEmptyIncomingTitle.tr(),
    TransfersScope.outgoing => LocaleKeys.transfersEmptyOutgoingTitle.tr(),
    TransfersScope.all => LocaleKeys.transfersEmptyAllTitle.tr(),
  };

  String _emptySubtitle(TransfersScope scope) => switch (scope) {
    TransfersScope.incoming => LocaleKeys.transfersEmptyIncomingSubtitle.tr(),
    TransfersScope.outgoing => LocaleKeys.transfersEmptyOutgoingSubtitle.tr(),
    TransfersScope.all => LocaleKeys.transfersEmptyAllSubtitle.tr(),
  };
}

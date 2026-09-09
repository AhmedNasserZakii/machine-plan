import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/feature/sync/data/logic/sync_queue_cubit.dart';
import 'package:machinery/feature/sync/data/logic/sync_queue_state.dart';
import 'package:machinery/feature/sync/presentation/widgets/sync_conflict_dialog.dart';
import 'package:machinery/feature/sync/presentation/widgets/sync_queue_tile.dart';

/// `/settings/sync` (`07`): every offline operation still waiting on the
/// server, why, and what the representative can do about it. Not a debug
/// screen — this is what a rep opens when a hand-off never shows up on head
/// office's system.
class SyncQueueScreen extends StatefulWidget {
  const SyncQueueScreen({super.key});

  @override
  State<SyncQueueScreen> createState() => _SyncQueueScreenState();
}

class _SyncQueueScreenState extends State<SyncQueueScreen> {
  @override
  void initState() {
    super.initState();
    context.read<SyncQueueCubit>().load();
  }

  Future<void> _onDeletePressed(SyncQueueDisplayItem display) async {
    final bool confirmed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.syncDeleteConfirmTitle.tr(),
      description: LocaleKeys.syncDeleteConfirmBody.tr(),
      confirmLabel: LocaleKeys.syncDeleteItem.tr(),
      isDestructive: true,
      icon: Icons.delete_outline_rounded,
    );
    if (!confirmed || !mounted) return;

    await context.read<SyncQueueCubit>().delete(display.item.clientUuid);
  }

  Future<void> _onConflictTapped(SyncQueueDisplayItem display) async {
    final bool shouldDelete = await SyncConflictDialog.show(
      context: context,
      item: display.item,
    );
    if (!shouldDelete || !mounted) return;

    await context.read<SyncQueueCubit>().delete(display.item.clientUuid);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(LocaleKeys.syncQueue.tr())),
      body: BlocBuilder<SyncQueueCubit, SyncQueueState>(
        builder: (context, state) {
          if (state.isLoading) {
            return const AppLoadingIndicator();
          }

          if (state.items.isEmpty) {
            return AppEmptyState(
              title: LocaleKeys.syncQueueEmpty.tr(),
              subtitle: LocaleKeys.emptyStateSubtitle.tr(),
              icon: Icons.cloud_done_outlined,
            );
          }

          return RefreshIndicator(
            onRefresh: context.read<SyncQueueCubit>().refresh,
            child: ListView.separated(
              padding: EdgeInsets.zero,
              itemCount: state.items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final SyncQueueDisplayItem display = state.items[index];
                return SyncQueueTile(
                  display: display,
                  onTap: () => _onConflictTapped(display),
                  onRetry: () => context.read<SyncQueueCubit>().retryNow(
                    display.item.clientUuid,
                  ),
                  onDelete: () => _onDeletePressed(display),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

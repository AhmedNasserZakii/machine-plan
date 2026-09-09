import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/services/sync/sync_coordinator.dart';
import 'package:machinery/core/services/sync/sync_queue_service.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/core/utils/enums.dart';

/// The plan's `07` app-bar badge ("pending count, spinner while syncing, red
/// dot on conflicts"), placed in `MainScaffold` instead of an actual app bar
/// — every tab in this app draws its own, so there is no single shared bar to
/// put it in. Renders nothing when the queue is empty, exactly like
/// `OfflineBanner` renders nothing while online: a rep with nothing pending
/// should not see permanent chrome for a feature he never uses.
class SyncSummaryBar extends StatefulWidget {
  const SyncSummaryBar({super.key});

  @override
  State<SyncSummaryBar> createState() => _SyncSummaryBarState();
}

class _SyncSummaryBarState extends State<SyncSummaryBar> {
  final SyncQueueService _queueService = getIt<SyncQueueService>();
  final SyncCoordinator _coordinator = getIt<SyncCoordinator>();

  int _pendingCount = 0;
  bool _hasConflict = false;
  StreamSubscription<void>? _subscription;

  @override
  void initState() {
    super.initState();
    _refresh();
    _subscription = _coordinator.onChange.listen((_) => _refresh());
  }

  Future<void> _refresh() async {
    final int count = await _queueService.pendingCount();
    final bool hasConflict =
        (await _queueService.all()).any((item) => item.status == SyncItemStatus.conflict);

    if (mounted) {
      setState(() {
        _pendingCount = count;
        _hasConflict = hasConflict;
      });
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_pendingCount == 0) return const SizedBox.shrink();

    final Color color = _hasConflict ? AppColors.dangerColor : AppColors.warningColor;

    return InkWell(
      onTap: () => AppRoute.goToSyncQueue(context: context),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        color: color.withValues(alpha: .08),
        child: Row(
          children: <Widget>[
            Icon(
              _hasConflict ? Icons.report_gmailerrorred_rounded : Icons.sync_rounded,
              size: 16,
              color: color,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                LocaleKeys.syncPendingCount.tr(args: <String>['$_pendingCount']),
                style: Styles.s12(context).copyWith(color: color, fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 16, color: color),
          ],
        ),
      ),
    );
  }
}

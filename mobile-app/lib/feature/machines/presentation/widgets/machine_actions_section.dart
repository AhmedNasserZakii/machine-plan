import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

/// Where the detail screen's actions live (`8.1`): the timeline and
/// maintenance history are real, permission-gated reads; transfer opens the
/// real create flow; replace and decommission are full write workflows that
/// belong to `11` and land here as "not ready yet" until that section is
/// built, so a director sees the entry point today without the app claiming a
/// feature that does not exist.
class MachineActionsSection extends StatelessWidget {
  const MachineActionsSection({
    required this.machine,
    required this.onViewTimeline,
    required this.onViewMaintenanceHistory,
    required this.onCreateTransfer,
    required this.onSendForMaintenance,
    required this.onReplace,
    required this.onDecommission,
    super.key,
  });

  final MachineEntity machine;
  final VoidCallback onViewTimeline;
  final VoidCallback onViewMaintenanceHistory;
  final VoidCallback onCreateTransfer;
  final VoidCallback onSendForMaintenance;
  final VoidCallback onReplace;
  final VoidCallback onDecommission;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.machineActionsTitle.tr(),
      icon: Icons.bolt_rounded,
      children: <Widget>[
        _ActionTile(
          identifier: 'machine_action_timeline',
          icon: Icons.history_rounded,
          label: LocaleKeys.machineTimelineTitle.tr(),
          onTap: onViewTimeline,
        ),
        PermissionGate(
          permission: P.maintenanceRead,
          child: _ActionTile(
            identifier: 'machine_action_maintenance_history',
            icon: Icons.build_circle_outlined,
            label: LocaleKeys.machineMaintenanceHistoryTitle.tr(),
            onTap: onViewMaintenanceHistory,
          ),
        ),
        // A retired unit has nothing left to hand off, repair or scrap again.
        if (!machine.isRetired) ...<Widget>[
          PermissionGate(
            permission: P.transfersCreate,
            child: _ActionTile(
              identifier: 'machine_action_transfer',
              icon: Icons.swap_horiz_rounded,
              label: LocaleKeys.transferCreateTitle.tr(),
              onTap: onCreateTransfer,
            ),
          ),
          // A repair opens while the unit sits in the company warehouse (the
          // dispatch leg starts there) — the server refuses one for a machine
          // still with a representative or merchant, so the tile is not shown
          // for a tap that can only fail.
          if (machine.status == MachineStatus.inCompanyWarehouse)
            PermissionGate(
              permission: P.maintenanceCreate,
              child: _ActionTile(
                identifier: 'machine_action_send_maintenance',
                icon: Icons.build_outlined,
                label: LocaleKeys.maintenanceActionSend.tr(),
                onTap: onSendForMaintenance,
              ),
            ),
          PermissionGate(
            permission: P.maintenanceClose,
            child: _ActionTile(
              identifier: 'machine_action_replace',
              icon: Icons.change_circle_outlined,
              label: LocaleKeys.machineReplaceAction.tr(),
              onTap: onReplace,
            ),
          ),
          PermissionGate(
            permission: P.machinesDecommission,
            child: _ActionTile(
              identifier: 'machine_action_decommission',
              icon: Icons.delete_forever_rounded,
              label: LocaleKeys.machineDecommissionAction.tr(),
              onTap: onDecommission,
              destructive: true,
            ),
          ),
        ],
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.identifier,
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final String identifier;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final Color color = destructive
        ? AppColors.dangerColor
        : AppColors.textPrimaryColor;

    return Semantics(
      identifier: identifier,
      // `DetailCard` paints its own opaque background directly above this
      // tile, which would otherwise swallow the tap ink — Material makes the
      // tile paint (and splash) on its own surface instead of relying on one
      // further up the tree.
      child: Material(
        type: MaterialType.transparency,
        child: ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon, size: 20, color: color),
          title: Text(
            label,
            style: Styles.s14(context).copyWith(color: color),
          ),
          trailing: const Icon(Icons.chevron_right_rounded, size: 20),
          onTap: onTap,
        ),
      ),
    );
  }
}

import 'package:machinery/core/shared_widgets/full_width_action.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';

/// The three-or-four things that can be done to an open violation: seen,
/// edited, charged, let go.
///
/// A standalone, presentation-only widget — no cubit, no repo — so its
/// permission gating is testable on its own, the way `MachineActionsSection`
/// is.
class ViolationActionsRow extends StatelessWidget {
  const ViolationActionsRow({
    required this.violation,
    required this.isBusy,
    required this.currentUserId,
    required this.onAcknowledge,
    required this.onCharge,
    required this.onWaive,
    required this.onEdit,
    super.key,
  });

  final ViolationEntity violation;
  final bool isBusy;

  /// Who is signed in right now. Acknowledgement is that person's own
  /// statement, so it is offered only to him — read the same way
  /// `UserFormActions` answers "is this me".
  final String? currentUserId;

  final VoidCallback onAcknowledge;
  final VoidCallback onCharge;
  final VoidCallback onWaive;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (violation.canAcknowledgeBy(currentUserId)) ...<Widget>[
          CustomButton(
            title: LocaleKeys.violationAcknowledge.tr(),
            isLoading: false,
            isStroked: true,
            onPressed: isBusy ? null : onAcknowledge,
            identifier: 'violation_acknowledge_button',
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                const Icon(Icons.visibility_outlined),
                const SizedBox(width: AppSpacing.sm),
                Text(LocaleKeys.violationAcknowledge.tr()),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          DetailNote(LocaleKeys.violationAcknowledgeHint.tr()),
          const SizedBox(height: AppSpacing.md),
        ],

        if (violation.isEditable) ...<Widget>[
          PermissionGate(
            permission: P.violationsResolve,
            child: CustomButton(
              title: LocaleKeys.violationEdit.tr(),
              isLoading: false,
              isStroked: true,
              onPressed: isBusy ? null : onEdit,
              identifier: 'violation_edit_button',
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  const Icon(Icons.edit_outlined),
                  const SizedBox(width: AppSpacing.sm),
                  Text(LocaleKeys.violationEdit.tr()),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],

        // Charging writes a finance transaction as well as closing the row,
        // so it needs both the authority to resolve a violation and the
        // authority to create a finance transaction — matching the backend's
        // `violations.resolve` + `finance.create` guard exactly, which a
        // single-permission `PermissionGate` cannot express.
        ValueListenableBuilder<List<String>>(
          valueListenable: getIt<PermissionService>().permissions,
          builder: (BuildContext context, List<String> _, _) {
            final bool canCharge = getIt<PermissionService>().hasAll(<String>[
              P.violationsResolve,
              P.financeCreate,
            ]);

            if (!canCharge) return const SizedBox.shrink();

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                FullWidthAction(
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
              ],
            );
          },
        ),
        PermissionGate(
          permission: P.violationsWaive,
          child: CustomButton(
            title: LocaleKeys.violationWaive.tr(),
            isLoading: false,
            isStroked: true,
            onPressed: isBusy ? null : onWaive,
            identifier: 'violation_waive_button',
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                const Icon(Icons.do_not_disturb_on_outlined),
                const SizedBox(width: AppSpacing.sm),
                Text(LocaleKeys.violationWaive.tr()),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_serial_text.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_status_chip.dart';

/// Confirms what the scan found before the app acts on it.
///
/// The "matched on" line is the point of this sheet. Scanning the battery
/// sticker resolves to the machine it is bonded to, and someone expecting the
/// serial they just pointed at needs to be told why a different one came back.
class ScannerResultSheet extends StatelessWidget {
  const ScannerResultSheet({required this.result, super.key});

  final MachineLookupResult result;

  static Future<bool?> show({
    required BuildContext context,
    required MachineLookupResult result,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => ScannerResultSheet(result: result),
    );
  }

  @override
  Widget build(BuildContext context) {
    final MachineEntity machine = result.machine;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                const Icon(
                  Icons.check_circle_outline_rounded,
                  color: AppColors.successColor,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    MachineLabels.matchedOn(result.matchedOn),
                    style: Styles.s13(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            MachineSerialText(
              machine.serial,
              copyable: false,
              style: Styles.s20(context).copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${machine.type.name} — ${machine.model.name}',
              style: Styles.s13(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            const SizedBox(height: AppSpacing.md),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: MachineStatusChip(status: machine.status),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomButton(
              title: LocaleKeys.confirm.tr(),
              isLoading: false,
              height: 48,
              identifier: 'scan_result_confirm',
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: AppSpacing.sm),
            CustomButton(
              title: LocaleKeys.scanRetry.tr(),
              isLoading: false,
              isStroked: true,
              height: 48,
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}

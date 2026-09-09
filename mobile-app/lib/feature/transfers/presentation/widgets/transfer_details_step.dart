import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// Step three: what is actually in the box for each machine.
///
/// The battery serial is checked here, on the device, against what the record
/// says is bonded to the unit. The warning has to appear while the person is
/// still holding it — after a round trip it is just a report.
class TransferDetailsStep extends StatelessWidget {
  const TransferDetailsStep({required this.state, super.key});

  final CreateTransferState state;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      itemCount: state.items.length + 1,
      itemBuilder: (BuildContext context, int index) {
        if (index == state.items.length) return const _NotesField();

        return _ItemDetails(item: state.items[index]);
      },
    );
  }
}

class _ItemDetails extends StatelessWidget {
  const _ItemDetails({required this.item});

  final DraftItem item;

  @override
  Widget build(BuildContext context) {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();
    final String machineId = item.machine.id;

    return Container(
      margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: item.batteryMatches == false
              ? AppColors.dangerColor
              : AppColors.borderColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          LtrText(
            item.machine.serial,
            style: Styles.mono(context).copyWith(fontWeight: FontWeight.w700),
          ),
          SwitchListTile.adaptive(
            value: item.params.hasCharger,
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.transferItemCharger.tr()),
            onChanged: (bool value) =>
                cubit.updateItem(machineId, hasCharger: value),
          ),
          SwitchListTile.adaptive(
            value: item.params.hasBox,
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.transferItemBox.tr()),
            onChanged: (bool value) =>
                cubit.updateItem(machineId, hasBox: value),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: TransferLabels.selectableConditions
                .map(
                  (ItemCondition condition) => ChoiceChip(
                    label: Text(TransferLabels.condition(condition)),
                    selected: item.params.condition == condition,
                    onSelected: (_) =>
                        cubit.updateItem(machineId, condition: condition),
                  ),
                )
                .toList(growable: false),
          ),
          const SizedBox(height: AppSpacing.md),
          LabeledTextFormField(
            label: LocaleKeys.transferScanBattery.tr(),
            hintText: LocaleKeys.scanManualEntryHint.tr(),
            textDirection: TextDirection.ltr,
            identifier: 'draft_battery_${item.machine.serial}',
            onChanged: (String value) =>
                cubit.updateItem(machineId, batterySerialScanned: value),
          ),
          if (item.batteryMatches != null) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            _BatteryVerdict(item: item),
          ],
        ],
      ),
    );
  }
}

/// Says plainly whether the battery in hand belongs to this machine. A mismatch
/// does not block the hand-off — it is recorded, and someone answers for it
/// later — but it must not go unsaid at the moment it is discovered.
class _BatteryVerdict extends StatelessWidget {
  const _BatteryVerdict({required this.item});

  final DraftItem item;

  @override
  Widget build(BuildContext context) {
    final bool matches = item.batteryMatches ?? false;
    final Color color = matches
        ? AppColors.successColor
        : AppColors.dangerColor;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(
          matches
              ? Icons.check_circle_outline_rounded
              : Icons.battery_alert_outlined,
          size: 16,
          color: color,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                matches
                    ? LocaleKeys.transferBatteryMatch.tr()
                    : LocaleKeys.transferItemBatteryMismatch.tr(),
                style: Styles.s12(
                  context,
                ).copyWith(color: color, fontWeight: FontWeight.w600),
              ),
              if (!matches && item.expectedBatterySerial != null)
                LtrText(
                  LocaleKeys.transferItemBatteryExpected.tr(
                    args: <String>[item.expectedBatterySerial!],
                  ),
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NotesField extends StatelessWidget {
  const _NotesField();

  @override
  Widget build(BuildContext context) {
    return LabeledTextFormField(
      label: LocaleKeys.transferNotes.tr(),
      hintText: LocaleKeys.transferNotes.tr(),
      maxLines: 3,
      identifier: 'transfer_notes_field',
      onChanged: context.read<CreateTransferCubit>().setNotes,
    );
  }
}

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// Where the receiver corrects one row.
///
/// His word wins: he is the one taking custody, so what he records here
/// overrides what the sender declared, and the difference between the two is
/// what the violation report is built from.
class ItemAdjustmentSheet extends StatefulWidget {
  const ItemAdjustmentSheet({
    required this.item,
    required this.current,
    super.key,
  });

  final TransferItemEntity item;

  /// What has already been corrected on this row, if anything.
  final ItemAdjustmentParams? current;

  static Future<ItemAdjustmentParams?> show({
    required BuildContext context,
    required TransferItemEntity item,
    ItemAdjustmentParams? current,
  }) {
    return showModalBottomSheet<ItemAdjustmentParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => ItemAdjustmentSheet(item: item, current: current),
    );
  }

  @override
  State<ItemAdjustmentSheet> createState() => _ItemAdjustmentSheetState();
}

class _ItemAdjustmentSheetState extends State<ItemAdjustmentSheet> {
  late bool _hasCharger;
  late bool _hasBox;
  late ItemCondition _condition;
  late final TextEditingController _batteryController;
  late final TextEditingController _notesController;

  @override
  void initState() {
    super.initState();

    // Seeded from the sender's declaration, so the receiver only touches what
    // is actually wrong.
    _hasCharger = widget.current?.hasCharger ?? widget.item.hasCharger;
    _hasBox = widget.current?.hasBox ?? widget.item.hasBox;
    _condition = widget.current?.condition ?? widget.item.condition;
    _batteryController = TextEditingController(
      text:
          widget.current?.batterySerialScanned ??
          widget.item.batterySerialScanned ??
          '',
    );
    _notesController = TextEditingController(
      text: widget.current?.notes ?? widget.item.notes ?? '',
    );
  }

  @override
  void dispose() {
    _batteryController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  /// Scanning is the point of a battery field the receiver corrects standing
  /// next to the unit (`8.2`) — this reads the raw sticker with no lookup, so
  /// a battery that does not match this machine's record is still capturable
  /// exactly as scanned. The mismatch itself is what the violation report is
  /// built from server-side; this screen's job is only to get an honest value
  /// into the field.
  Future<void> _scanBattery() async {
    final String? code = await AppRoute.goToRawBarcodeScanner(
      context: context,
      titleKey: LocaleKeys.scanBatteryScanTooltip,
    );

    if (code == null || !mounted) {
      return;
    }

    setState(() => _batteryController.text = code);
  }

  /// Only what differs from the sender's version is sent. An absent field means
  /// "his declaration stands", which is not the same as re-asserting it.
  void _submit() {
    final String battery = _batteryController.text.trim();
    final String notes = _notesController.text.trim();

    Navigator.of(context).pop(
      ItemAdjustmentParams(
        transferItemId: widget.item.id,
        hasCharger: _hasCharger == widget.item.hasCharger ? null : _hasCharger,
        hasBox: _hasBox == widget.item.hasBox ? null : _hasBox,
        condition: _condition == widget.item.condition ? null : _condition,
        batterySerialScanned:
            battery == (widget.item.batterySerialScanned ?? '') ||
                battery.isEmpty
            ? null
            : battery,
        notes: notes == (widget.item.notes ?? '') || notes.isEmpty
            ? null
            : notes,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(widget.item.machine.serial, style: Styles.s17(context)),
              const SizedBox(height: AppSpacing.lg),
              SwitchListTile.adaptive(
                value: _hasCharger,
                contentPadding: EdgeInsets.zero,
                title: Text(LocaleKeys.transferItemCharger.tr()),
                onChanged: (bool value) => setState(() => _hasCharger = value),
              ),
              SwitchListTile.adaptive(
                value: _hasBox,
                contentPadding: EdgeInsets.zero,
                title: Text(LocaleKeys.transferItemBox.tr()),
                onChanged: (bool value) => setState(() => _hasBox = value),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                LocaleKeys.transferItemCondition.tr(),
                style: Styles.s14(context).copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: TransferLabels.selectableConditions
                    .map(
                      (ItemCondition condition) => ChoiceChip(
                        label: Text(TransferLabels.condition(condition)),
                        selected: _condition == condition,
                        onSelected: (_) =>
                            setState(() => _condition = condition),
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.lg),
              LabeledTextFormField(
                label: LocaleKeys.transferScanBattery.tr(),
                hintText: LocaleKeys.scanManualEntryHint.tr(),
                controller: _batteryController,
                // A serial reads left-to-right whatever the interface language.
                textDirection: TextDirection.ltr,
                identifier: 'adjust_battery_field',
                suffixIcon: IconButton(
                  onPressed: _scanBattery,
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 20),
                  tooltip: LocaleKeys.scanBatteryScanTooltip.tr(),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              LabeledTextFormField(
                label: LocaleKeys.transferNotes.tr(),
                hintText: LocaleKeys.transferNotes.tr(),
                controller: _notesController,
                maxLines: 3,
                identifier: 'adjust_notes_field',
              ),
              const SizedBox(height: AppSpacing.lg),
              CustomButton(
                title: LocaleKeys.confirm.tr(),
                isLoading: false,
                height: 48,
                identifier: 'adjust_submit',
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

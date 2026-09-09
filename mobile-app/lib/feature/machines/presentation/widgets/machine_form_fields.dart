import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/data/logic/machine_form/machine_form_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_model_selector.dart';

/// Every input on the intake and edit form.
///
/// The serial fields disappear entirely in edit mode rather than being shown
/// disabled: the server refuses a patch that carries one, and a greyed-out box
/// still invites a user to try.
class MachineFormFields extends StatelessWidget {
  const MachineFormFields({
    required this.state,
    required this.isEditing,
    required this.serialController,
    required this.batterySerialController,
    required this.simSerialController,
    required this.boxSerialController,
    required this.priceController,
    required this.invoiceController,
    required this.notesController,
    required this.onModelSelected,
    required this.onHasBoxChanged,
    required this.onPurchaseDatePicked,
    required this.onWarrantyStartPicked,
    required this.onWarrantyEndPicked,
    required this.purchaseDate,
    super.key,
  });

  final MachineFormReady state;
  final bool isEditing;

  final TextEditingController serialController;
  final TextEditingController batterySerialController;
  final TextEditingController simSerialController;
  final TextEditingController boxSerialController;
  final TextEditingController priceController;
  final TextEditingController invoiceController;
  final TextEditingController notesController;

  final ValueChanged<MachineModelEntity> onModelSelected;
  final ValueChanged<bool> onHasBoxChanged;
  final ValueChanged<String?> onPurchaseDatePicked;
  final ValueChanged<String?> onWarrantyStartPicked;
  final ValueChanged<String?> onWarrantyEndPicked;
  final String? purchaseDate;

  String? _required(String? value) {
    return (value == null || value.trim().isEmpty)
        ? LocaleKeys.thisFieldIsRequired.tr()
        : null;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        MachineModelSelector(
          models: state.models,
          selected: state.selectedModel,
          onSelected: onModelSelected,
          errorText: state.fieldErrors['machineModelId'],
        ),
        const SizedBox(height: AppSpacing.md),

        if (isEditing)
          DetailNote(
            LocaleKeys.serialImmutableNote.tr(),
            icon: Icons.lock_outline_rounded,
          )
        else
          _SerialFields(
            state: state,
            serialController: serialController,
            batterySerialController: batterySerialController,
            simSerialController: simSerialController,
            boxSerialController: boxSerialController,
            onHasBoxChanged: onHasBoxChanged,
            validator: _required,
          ),

        const SizedBox(height: AppSpacing.lg),
        Text(
          LocaleKeys.machinePurchaseTitle.tr(),
          style: Styles.s15(context).copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.machinePurchasePrice.tr(),
          hintText: LocaleKeys.machinePurchasePrice.tr(),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textInputAction: TextInputAction.next,
          controller: priceController,
          errorText: state.fieldErrors['purchasePrice'],
          identifier: 'machine_price_field',
        ),
        const SizedBox(height: AppSpacing.md),

        _DateField(
          label: LocaleKeys.machinePurchaseDate.tr(),
          value: purchaseDate,
          onPicked: onPurchaseDatePicked,
          identifier: 'machine_purchase_date_field',
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.machineInvoiceNo.tr(),
          hintText: LocaleKeys.machineInvoiceNo.tr(),
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.next,
          controller: invoiceController,
          errorText: state.fieldErrors['factoryInvoiceNo'],
          identifier: 'machine_invoice_field',
        ),

        const SizedBox(height: AppSpacing.lg),
        Text(
          LocaleKeys.machineWarrantyTitle.tr(),
          style: Styles.s15(context).copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.md),

        _DateField(
          label: LocaleKeys.machineWarrantyStart.tr(),
          value: state.warrantyStart,
          onPicked: onWarrantyStartPicked,
          identifier: 'machine_warranty_start_field',
        ),
        const SizedBox(height: AppSpacing.md),
        _DateField(
          label: LocaleKeys.machineWarrantyEnd.tr(),
          value: state.warrantyEnd,
          onPicked: onWarrantyEndPicked,
          identifier: 'machine_warranty_end_field',
        ),

        const SizedBox(height: AppSpacing.md),
        LabeledTextFormField(
          label: LocaleKeys.machineNotes.tr(),
          hintText: LocaleKeys.machineNotes.tr(),
          keyboardType: TextInputType.multiline,
          textInputAction: TextInputAction.newline,
          controller: notesController,
          identifier: 'machine_notes_field',
        ),
      ],
    );
  }
}

/// The four serials, shown only on intake.
class _SerialFields extends StatelessWidget {
  const _SerialFields({
    required this.state,
    required this.serialController,
    required this.batterySerialController,
    required this.simSerialController,
    required this.boxSerialController,
    required this.onHasBoxChanged,
    required this.validator,
  });

  final MachineFormReady state;
  final TextEditingController serialController;
  final TextEditingController batterySerialController;
  final TextEditingController simSerialController;
  final TextEditingController boxSerialController;
  final ValueChanged<bool> onHasBoxChanged;
  final String? Function(String?) validator;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        LabeledTextFormField(
          label: LocaleKeys.machineSerial.tr(),
          hintText: LocaleKeys.machineSerial.tr(),
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.next,
          controller: serialController,
          validation: validator,
          errorText: state.fieldErrors['serial'],
          textDirection: TextDirection.ltr,
          identifier: 'machine_serial_field',
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.batterySerial.tr(),
          hintText: LocaleKeys.batterySerial.tr(),
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.next,
          controller: batterySerialController,
          validation: validator,
          errorText: state.fieldErrors['batterySerial'],
          textDirection: TextDirection.ltr,
          identifier: 'machine_battery_serial_field',
        ),
        const SizedBox(height: AppSpacing.xs),
        DetailNote(
          LocaleKeys.machineBatteryBond.tr(),
          icon: Icons.battery_charging_full_rounded,
        ),
        const SizedBox(height: AppSpacing.md),

        // Hidden, not disabled: the server rejects a SIM sent for a type that
        // has no mobile line.
        if (state.requiresSim) ...<Widget>[
          LabeledTextFormField(
            label: LocaleKeys.simSerial.tr(),
            hintText: LocaleKeys.simSerial.tr(),
            keyboardType: TextInputType.text,
            textInputAction: TextInputAction.next,
            controller: simSerialController,
            validation: validator,
            errorText: state.fieldErrors['simSerial'],
            textDirection: TextDirection.ltr,
            identifier: 'machine_sim_serial_field',
          ),
          const SizedBox(height: AppSpacing.xs),
          DetailNote(
            LocaleKeys.simImmutableNote.tr(),
            icon: Icons.sim_card_outlined,
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        LabeledTextFormField(
          label: LocaleKeys.boxSerial.tr(),
          hintText: LocaleKeys.boxSerialNotPrinted.tr(),
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.next,
          controller: boxSerialController,
          errorText: state.fieldErrors['boxSerial'],
          textDirection: TextDirection.ltr,
          identifier: 'machine_box_serial_field',
        ),

        SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          value: state.hasBox,
          onChanged: onHasBoxChanged,
          title: Text(
            LocaleKeys.machineHasBox.tr(),
            style: Styles.s14(context),
          ),
          subtitle: Text(
            LocaleKeys.machineHasBoxHint.tr(),
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ),
      ],
    );
  }
}

/// A read-only field that opens a date picker. Dates are stored and sent as
/// `yyyy-MM-dd`, and displayed in the app's format.
class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onPicked,
    required this.identifier,
  });

  final String label;
  final String? value;
  final ValueChanged<String?> onPicked;
  final String identifier;

  static final DateTime _earliest = DateTime(2015);

  Future<void> _pick(BuildContext context) async {
    final DateTime now = DateTime.now();

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: Formatters.tryParseDate(value) ?? now,
      firstDate: _earliest,
      // Warranties end in the future, so this cannot be capped at today.
      lastDate: DateTime(now.year + 10),
    );

    if (picked == null) {
      return;
    }

    onPicked(picked.toIso8601String().split('T').first);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: Styles.s14(context).copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondaryColor,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          identifier: identifier,
          child: InkWell(
            onTap: () => _pick(context),
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: InputDecorator(
              decoration: InputDecoration(
                suffixIcon: value == null
                    ? const Icon(Icons.calendar_today_outlined, size: 18)
                    : IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18),
                        onPressed: () => onPicked(null),
                      ),
              ),
              child: Text(
                Formatters.isoDate(value) ?? label,
                style: Styles.s14(context).copyWith(
                  color: value == null ? AppColors.textDisabledColor : null,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/data/logic/machine_bulk_import/machine_bulk_import_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_bulk_import/machine_bulk_import_state.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_model_selector.dart';

/// Factory intake, many units at once (`8.1`).
///
/// One shipment shares one model and one purchase/warranty story, so those
/// fields are asked for once; only the four serials vary row to row. The
/// server validates and commits the whole batch atomically, so a rejected
/// batch creates nothing — the per-row errors below are for fixing the sheet
/// and resubmitting, never for salvaging a partial import that never happened.
class MachineBulkImportScreen extends StatefulWidget {
  const MachineBulkImportScreen({super.key});

  @override
  State<MachineBulkImportScreen> createState() =>
      _MachineBulkImportScreenState();
}

class _MachineBulkImportScreenState extends State<MachineBulkImportScreen> {
  final Map<String, _RowControllers> _rowControllers =
      <String, _RowControllers>{};

  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _invoiceController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<MachineBulkImportCubit>().load();
  }

  @override
  void dispose() {
    for (final _RowControllers controllers in _rowControllers.values) {
      controllers.dispose();
    }
    _priceController.dispose();
    _invoiceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  _RowControllers _controllersFor(MachineImportRow row) {
    return _rowControllers.putIfAbsent(
      row.key,
      () => _RowControllers(row: row),
    );
  }

  /// Rows removed from state must not leak their controllers.
  void _pruneControllers(List<MachineImportRow> rows) {
    final Set<String> keys = rows.map((MachineImportRow r) => r.key).toSet();
    final List<String> stale = _rowControllers.keys
        .where((String key) => !keys.contains(key))
        .toList(growable: false);

    for (final String key in stale) {
      _rowControllers.remove(key)?.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.machineBulkImportTitle.tr()),
      ),
      body: BlocConsumer<MachineBulkImportCubit, MachineBulkImportState>(
        listener: (BuildContext context, MachineBulkImportState state) {
          if (state is MachineBulkImportSubmitted) {
            showSuccessToast(
              LocaleKeys.machineBulkImportSuccess.plural(state.createdCount),
              context,
            );
            AppRoute.goBack(context: context, result: true);
          }
        },
        builder: (BuildContext context, MachineBulkImportState state) {
          return switch (state) {
            MachineBulkImportLoadFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MachineBulkImportCubit>().load(),
              ),
            MachineBulkImportReady() => _buildForm(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, MachineBulkImportReady state) {
    _pruneControllers(state.rows);
    final MachineBulkImportCubit cubit = context.read<MachineBulkImportCubit>();

    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: ListView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              children: <Widget>[
                if (state.generalError != null) ...<Widget>[
                  _ErrorBanner(message: state.generalError!),
                  const SizedBox(height: AppSpacing.md),
                ],
                MachineModelSelector(
                  models: state.models,
                  selected: state.selectedModel,
                  onSelected: cubit.selectModel,
                ),
                const SizedBox(height: AppSpacing.md),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: state.hasBox,
                  onChanged: (bool value) => cubit.setHasBox(hasBox: value),
                  title: Text(
                    LocaleKeys.machineHasBox.tr(),
                    style: Styles.s14(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                LabeledTextFormField(
                  label: LocaleKeys.machinePurchasePrice.tr(),
                  hintText: LocaleKeys.machinePurchasePrice.tr(),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  controller: _priceController,
                  identifier: 'machine_bulk_price_field',
                  onFieldSubmitted: (_) => cubit.setPurchasePrice(
                    double.tryParse(_priceController.text.trim()),
                  ),
                  onChanged: (String value) =>
                      cubit.setPurchasePrice(double.tryParse(value.trim())),
                ),
                const SizedBox(height: AppSpacing.md),
                _DateField(
                  label: LocaleKeys.machinePurchaseDate.tr(),
                  value: state.purchaseDate,
                  onPicked: cubit.setPurchaseDate,
                  identifier: 'machine_bulk_purchase_date_field',
                ),
                const SizedBox(height: AppSpacing.md),
                LabeledTextFormField(
                  label: LocaleKeys.machineInvoiceNo.tr(),
                  hintText: LocaleKeys.machineInvoiceNo.tr(),
                  controller: _invoiceController,
                  identifier: 'machine_bulk_invoice_field',
                  onChanged: cubit.setFactoryInvoiceNo,
                ),
                const SizedBox(height: AppSpacing.md),
                _DateField(
                  label: LocaleKeys.machineWarrantyStart.tr(),
                  value: state.warrantyStart,
                  onPicked: cubit.setWarrantyStart,
                  identifier: 'machine_bulk_warranty_start_field',
                ),
                const SizedBox(height: AppSpacing.md),
                _DateField(
                  label: LocaleKeys.machineWarrantyEnd.tr(),
                  value: state.warrantyEnd,
                  onPicked: cubit.setWarrantyEnd,
                  identifier: 'machine_bulk_warranty_end_field',
                ),
                const SizedBox(height: AppSpacing.md),
                LabeledTextFormField(
                  label: LocaleKeys.machineNotes.tr(),
                  hintText: LocaleKeys.machineNotes.tr(),
                  maxLines: 2,
                  controller: _notesController,
                  identifier: 'machine_bulk_notes_field',
                  onChanged: cubit.setNotes,
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: <Widget>[
                    Text(
                      LocaleKeys.machineBulkImportUnits.tr(
                        args: <String>['${state.rows.length}'],
                      ),
                      style: Styles.s15(
                        context,
                      ).copyWith(fontWeight: FontWeight.w600),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed:
                          state.rows.length >= MachineBulkImportCubit.maxRows
                          ? null
                          : cubit.addRow,
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: Semantics(
                        identifier: 'machine_bulk_add_row',
                        child: Text(LocaleKeys.machineBulkImportAddRow.tr()),
                      ),
                    ),
                  ],
                ),
                for (int i = 0; i < state.rows.length; i++)
                  _RowCard(
                    index: i,
                    row: state.rows[i],
                    controllers: _controllersFor(state.rows[i]),
                    requiresSim: state.requiresSim,
                    hasBox: state.hasBox,
                    errors: state.rowErrors[i] ?? const <String, String>{},
                    canRemove: state.rows.length > 1,
                    onChanged: cubit.updateRow,
                    onRemove: () => cubit.removeRow(state.rows[i].key),
                  ),
                const SizedBox(height: AppSpacing.xxl),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: PermissionGate(
              permission: P.machinesImport,
              child: CustomButton(
                title: LocaleKeys.machineBulkImportSubmit.tr(
                  args: <String>['${state.rows.length}'],
                ),
                isLoading: state.isSubmitting,
                identifier: 'machine_bulk_submit',
                onPressed: state.selectedModel == null
                    ? null
                    : () => _submit(context, state),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _submit(BuildContext context, MachineBulkImportReady state) {
    // Every row's controller is the source of truth for its own text; the
    // cubit only sees a value when the field fires `onChanged`, which a row
    // never does for its last keystroke before the submit tap steals focus.
    for (final MapEntry<String, _RowControllers> entry
        in _rowControllers.entries) {
      final _RowControllers c = entry.value;
      context.read<MachineBulkImportCubit>().updateRow(
        entry.key,
        serial: c.serial.text,
        batterySerial: c.battery.text,
        simSerial: c.sim.text,
        boxSerial: c.box.text,
      );
    }

    for (final MachineImportRow row in state.rows) {
      final _RowControllers c = _rowControllers[row.key]!;
      if (c.serial.text.trim().isEmpty || c.battery.text.trim().isEmpty) {
        showErrorToast(LocaleKeys.thisFieldIsRequired.tr(), context);
        return;
      }
    }

    context.read<MachineBulkImportCubit>().submit();
  }
}

class _RowControllers {
  _RowControllers({required MachineImportRow row})
    : serial = TextEditingController(text: row.serial),
      battery = TextEditingController(text: row.batterySerial),
      sim = TextEditingController(text: row.simSerial),
      box = TextEditingController(text: row.boxSerial);

  final TextEditingController serial;
  final TextEditingController battery;
  final TextEditingController sim;
  final TextEditingController box;

  void dispose() {
    serial.dispose();
    battery.dispose();
    sim.dispose();
    box.dispose();
  }
}

class _RowCard extends StatelessWidget {
  const _RowCard({
    required this.index,
    required this.row,
    required this.controllers,
    required this.requiresSim,
    required this.hasBox,
    required this.errors,
    required this.canRemove,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final MachineImportRow row;
  final _RowControllers controllers;
  final bool requiresSim;
  final bool hasBox;
  final Map<String, String> errors;
  final bool canRemove;
  final void Function(
    String key, {
    String? serial,
    String? batterySerial,
    String? simSerial,
    String? boxSerial,
  })
  onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsetsDirectional.only(top: AppSpacing.md),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Text(
                  '#${index + 1}',
                  style: Styles.s13(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                if (canRemove)
                  IconButton(
                    onPressed: onRemove,
                    icon: const Icon(Icons.delete_outline_rounded, size: 20),
                    tooltip: LocaleKeys.machineBulkImportRemoveRow.tr(),
                  ),
              ],
            ),
            LabeledTextFormField(
              label: LocaleKeys.machineSerial.tr(),
              hintText: LocaleKeys.machineSerial.tr(),
              controller: controllers.serial,
              textDirection: TextDirection.ltr,
              errorText: errors['serial'],
              identifier: 'machine_bulk_row_${index}_serial',
              onChanged: (String v) => onChanged(row.key, serial: v),
            ),
            const SizedBox(height: AppSpacing.sm),
            LabeledTextFormField(
              label: LocaleKeys.batterySerial.tr(),
              hintText: LocaleKeys.batterySerial.tr(),
              controller: controllers.battery,
              textDirection: TextDirection.ltr,
              errorText: errors['battery.serial'] ?? errors['batterySerial'],
              identifier: 'machine_bulk_row_${index}_battery',
              onChanged: (String v) => onChanged(row.key, batterySerial: v),
            ),
            if (requiresSim) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              LabeledTextFormField(
                label: LocaleKeys.simSerial.tr(),
                hintText: LocaleKeys.simSerial.tr(),
                controller: controllers.sim,
                textDirection: TextDirection.ltr,
                errorText: errors['simSerial'],
                identifier: 'machine_bulk_row_${index}_sim',
                onChanged: (String v) => onChanged(row.key, simSerial: v),
              ),
            ],
            if (hasBox) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              LabeledTextFormField(
                label: LocaleKeys.boxSerial.tr(),
                hintText: LocaleKeys.boxSerialNotPrinted.tr(),
                controller: controllers.box,
                textDirection: TextDirection.ltr,
                errorText: errors['boxSerial'],
                identifier: 'machine_bulk_row_${index}_box',
                onChanged: (String v) => onChanged(row.key, boxSerial: v),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.dangerColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.dangerColor.withValues(alpha: 0.3)),
      ),
      child: Text(
        message,
        style: Styles.s13(context).copyWith(color: AppColors.dangerColor),
      ),
    );
  }
}

/// Same shape as the single-machine form's date field
/// (`machine_form_fields.dart`'s private `_DateField`) — kept as its own copy
/// rather than shared, since the two forms have never needed to change in
/// lockstep and neither exports its private widgets.
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

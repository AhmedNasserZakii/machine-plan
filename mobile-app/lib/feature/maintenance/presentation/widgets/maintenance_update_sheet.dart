import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';

/// A correction to an order still open enough to correct — the fault
/// description, which workshop it is at, and (while unclosed) the running
/// cost. Prefilled from [order] so this is an edit, not a re-entry.
class MaintenanceUpdateSheet extends StatefulWidget {
  const MaintenanceUpdateSheet({required this.order, super.key});

  final MaintenanceOrderEntity order;

  static Future<UpdateMaintenanceOrderParams?> show({
    required BuildContext context,
    required MaintenanceOrderEntity order,
  }) {
    return showModalBottomSheet<UpdateMaintenanceOrderParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => MaintenanceUpdateSheet(order: order),
    );
  }

  @override
  State<MaintenanceUpdateSheet> createState() =>
      _MaintenanceUpdateSheetState();
}

class _MaintenanceUpdateSheetState extends State<MaintenanceUpdateSheet> {
  late final TextEditingController _faultController = TextEditingController(
    text: widget.order.reportedFault ?? '',
  );
  late final TextEditingController _costController = TextEditingController(
    text: widget.order.cost?.toString() ?? '',
  );
  late final TextEditingController _performedByController =
      TextEditingController(text: widget.order.performedByName ?? '');
  late final TextEditingController _notesController = TextEditingController(
    text: widget.order.notes ?? '',
  );

  List<LookupEntity>? _locations;
  late String? _locationId = widget.order.location.id;

  bool get _canEditCost => !widget.order.isClosed;

  @override
  void initState() {
    super.initState();
    _loadLocations();
  }

  Future<void> _loadLocations() async {
    final result = await getIt<LookupsRepo>().maintenanceLocations();
    if (!mounted) return;

    setState(() => _locations = result.getOrElse(() => const <LookupEntity>[]));
  }

  @override
  void dispose() {
    _faultController.dispose();
    _costController.dispose();
    _performedByController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  String? _nullIfBlank(String raw) {
    final String trimmed = raw.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  void _submit() {
    Navigator.of(context).pop(
      UpdateMaintenanceOrderParams(
        reportedFault: _nullIfBlank(_faultController.text),
        locationId: _locationId,
        cost: _canEditCost ? double.tryParse(_costController.text.trim()) : null,
        performedByName: _nullIfBlank(_performedByController.text),
        notes: _nullIfBlank(_notesController.text),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<LookupEntity>? locations = _locations;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.85,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  LocaleKeys.maintenanceActionEdit.tr(),
                  style: Styles.s17(context),
                ),
                const SizedBox(height: AppSpacing.lg),

                LabeledTextFormField(
                  label: LocaleKeys.maintenanceReportedFault.tr(),
                  hintText: LocaleKeys.maintenanceReportedFaultHint.tr(),
                  controller: _faultController,
                  maxLines: 3,
                  identifier: 'maintenance_update_fault',
                ),
                const SizedBox(height: AppSpacing.lg),

                if (locations == null)
                  const Center(child: AppLoadingIndicator())
                else if (locations.isNotEmpty) ...<Widget>[
                  Text(
                    LocaleKeys.maintenanceSelectLocation.tr(),
                    style: Styles.s14(context).copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondaryColor,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  FilterChoiceRow(
                    labels: locations
                        .map((LookupEntity l) => l.name)
                        .toList(growable: false),
                    values: locations
                        .map((LookupEntity l) => l.id)
                        .toList(growable: false),
                    selected: _locationId,
                    onSelected: (String? value) {
                      if (value != null) setState(() => _locationId = value);
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],

                if (_canEditCost) ...<Widget>[
                  LabeledTextFormField(
                    label: LocaleKeys.maintenanceCost.tr(),
                    hintText: '0.00',
                    controller: _costController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    identifier: 'maintenance_update_cost',
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],

                LabeledTextFormField(
                  label: LocaleKeys.maintenancePerformedBy.tr(),
                  hintText: '',
                  controller: _performedByController,
                  identifier: 'maintenance_update_performed_by',
                ),
                const SizedBox(height: AppSpacing.lg),

                LabeledTextFormField(
                  label: LocaleKeys.maintenanceNotes.tr(),
                  hintText: '',
                  controller: _notesController,
                  maxLines: 3,
                  identifier: 'maintenance_update_notes',
                ),
                const SizedBox(height: AppSpacing.lg),

                CustomButton(
                  title: LocaleKeys.confirm.tr(),
                  isLoading: false,
                  height: 48,
                  identifier: 'maintenance_update_submit',
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

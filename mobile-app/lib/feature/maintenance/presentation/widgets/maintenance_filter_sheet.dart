import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/filter_section.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/maintenance_labels.dart';

class MaintenanceFilterSheet extends StatefulWidget {
  const MaintenanceFilterSheet({
    required this.locations,
    required this.current,
    super.key,
  });

  final List<LookupEntity> locations;
  final MaintenanceOrdersQueryParams current;

  static Future<MaintenanceOrdersQueryParams?> show({
    required BuildContext context,
    required List<LookupEntity> locations,
    required MaintenanceOrdersQueryParams current,
  }) {
    return showModalBottomSheet<MaintenanceOrdersQueryParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) =>
          MaintenanceFilterSheet(locations: locations, current: current),
    );
  }

  @override
  State<MaintenanceFilterSheet> createState() =>
      _MaintenanceFilterSheetState();
}

class _MaintenanceFilterSheetState extends State<MaintenanceFilterSheet> {
  late Set<MaintenanceOrderStatus> _statuses;
  String? _locationId;
  bool? _isFreeUnderWarranty;

  @override
  void initState() {
    super.initState();
    _statuses = widget.current.statuses.toSet();
    _locationId = widget.current.locationId;
    _isFreeUnderWarranty = widget.current.isFreeUnderWarranty;
  }

  MaintenanceOrdersQueryParams get _result {
    return widget.current.copyWith(
      page: 1,
      statuses: _statuses.toList(growable: false),
      locationId: _locationId,
      isFreeUnderWarranty: _isFreeUnderWarranty,
      resetLocation: _locationId == null,
      resetWarranty: _isFreeUnderWarranty == null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                LocaleKeys.maintenanceFilterTitle.tr(),
                style: Styles.s17(context),
              ),
              const SizedBox(height: AppSpacing.lg),

              FilterSection(
                title: LocaleKeys.maintenanceDetailTitle.tr(),
                child: Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: MaintenanceLabels.filterableStatuses.map((
                    MaintenanceOrderStatus status,
                  ) {
                    final bool isSelected = _statuses.contains(status);
                    return FilterChip(
                      label: Text(
                        MaintenanceLabels.status(status),
                        style: Styles.s13(context),
                      ),
                      selected: isSelected,
                      showCheckmark: false,
                      backgroundColor: AppColors.surfaceAltColor,
                      selectedColor: AppColors.primaryLightColor,
                      side: BorderSide(
                        color: isSelected
                            ? AppColors.primaryColor
                            : AppColors.borderColor,
                      ),
                      onSelected: (_) => setState(() {
                        if (!_statuses.remove(status)) {
                          _statuses.add(status);
                        }
                      }),
                    );
                  }).toList(growable: false),
                ),
              ),

              if (widget.locations.isNotEmpty)
                FilterSection(
                  title: LocaleKeys.maintenanceSelectLocation.tr(),
                  child: FilterChoiceRow(
                    labels: <String>[
                      LocaleKeys.all.tr(),
                      ...widget.locations.map((LookupEntity l) => l.name),
                    ],
                    values: <String?>[
                      null,
                      ...widget.locations.map((LookupEntity l) => l.id),
                    ],
                    selected: _locationId,
                    onSelected: (String? value) =>
                        setState(() => _locationId = value),
                  ),
                ),

              FilterSection(
                title: LocaleKeys.maintenanceFreeUnderWarranty.tr(),
                child: FilterChoiceRow(
                  labels: <String>[
                    LocaleKeys.all.tr(),
                    LocaleKeys.yes.tr(),
                    LocaleKeys.no.tr(),
                  ],
                  values: const <String?>['all', 'yes', 'no'],
                  selected: switch (_isFreeUnderWarranty) {
                    true => 'yes',
                    false => 'no',
                    null => 'all',
                  },
                  onSelected: (String? value) => setState(() {
                    _isFreeUnderWarranty = switch (value) {
                      'yes' => true,
                      'no' => false,
                      _ => null,
                    };
                  }),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              CustomButton(
                title: LocaleKeys.confirm.tr(),
                isLoading: false,
                height: 48,
                identifier: 'maintenance_filter_apply',
                onPressed: () => Navigator.of(context).pop(_result),
              ),
              const SizedBox(height: AppSpacing.sm),
              CustomButton(
                title: LocaleKeys.clear.tr(),
                isLoading: false,
                isStroked: true,
                height: 48,
                onPressed: () =>
                    Navigator.of(context).pop(widget.current.cleared()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

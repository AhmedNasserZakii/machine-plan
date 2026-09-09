import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/filter_section.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';

/// The chosen filters, or null when the sheet was dismissed without applying.
class UsersFilterResult {
  const UsersFilterResult({this.roleId, this.branchId, this.isActive});

  final String? roleId;
  final String? branchId;
  final bool? isActive;
}

class UsersFilterSheet extends StatefulWidget {
  const UsersFilterSheet({
    required this.roles,
    required this.branches,
    required this.current,
    super.key,
  });

  final List<RoleEntity> roles;
  final List<BranchEntity> branches;
  final UsersQueryParams current;

  static Future<UsersFilterResult?> show({
    required BuildContext context,
    required List<RoleEntity> roles,
    required List<BranchEntity> branches,
    required UsersQueryParams current,
  }) {
    return showModalBottomSheet<UsersFilterResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) =>
          UsersFilterSheet(roles: roles, branches: branches, current: current),
    );
  }

  @override
  State<UsersFilterSheet> createState() => _UsersFilterSheetState();
}

class _UsersFilterSheetState extends State<UsersFilterSheet> {
  String? _roleId;
  String? _branchId;
  bool? _isActive;

  @override
  void initState() {
    super.initState();
    _roleId = widget.current.roleId;
    _branchId = widget.current.branchId;
    _isActive = widget.current.isActive;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(LocaleKeys.userFilters.tr(), style: Styles.s17(context)),
            const SizedBox(height: AppSpacing.lg),

            FilterSection(
              title: LocaleKeys.userRole.tr(),
              child: FilterChoiceRow(
                labels: <String>[
                  LocaleKeys.userFilterAll.tr(),
                  ...widget.roles.map((RoleEntity r) => r.displayName),
                ],
                values: <String?>[
                  null,
                  ...widget.roles.map((RoleEntity r) => r.id),
                ],
                selected: _roleId,
                onSelected: (String? value) => setState(() => _roleId = value),
              ),
            ),

            if (widget.branches.isNotEmpty)
              FilterSection(
                title: LocaleKeys.userBranch.tr(),
                child: FilterChoiceRow(
                  labels: <String>[
                    LocaleKeys.userFilterAll.tr(),
                    ...widget.branches.map((BranchEntity b) => b.name),
                  ],
                  values: <String?>[
                    null,
                    ...widget.branches.map((BranchEntity b) => b.id),
                  ],
                  selected: _branchId,
                  onSelected: (String? value) =>
                      setState(() => _branchId = value),
                ),
              ),

            FilterSection(
              title: LocaleKeys.userFilterStatus.tr(),
              child: FilterChoiceRow(
                labels: <String>[
                  LocaleKeys.userFilterAll.tr(),
                  LocaleKeys.userActive.tr(),
                  LocaleKeys.userInactive.tr(),
                ],
                values: const <String?>[null, 'true', 'false'],
                selected: _isActive?.toString(),
                onSelected: (String? value) => setState(
                  () => _isActive = value == null ? null : value == 'true',
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.lg),
            CustomButton(
              title: LocaleKeys.confirm.tr(),
              isLoading: false,
              height: 48,
              identifier: 'users_filter_apply',
              onPressed: () => Navigator.of(context).pop(
                UsersFilterResult(
                  roleId: _roleId,
                  branchId: _branchId,
                  isActive: _isActive,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            CustomButton(
              title: LocaleKeys.userClearFilters.tr(),
              isLoading: false,
              isStroked: true,
              height: 48,
              onPressed: () =>
                  Navigator.of(context).pop(const UsersFilterResult()),
            ),
          ],
        ),
      ),
    );
  }
}

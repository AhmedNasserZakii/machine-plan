import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/users/data/logic/roles/roles_cubit.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';

class RolePermissionsScreen extends StatefulWidget {
  const RolePermissionsScreen({required this.role, super.key});
  final RoleEntity role;
  @override
  State<RolePermissionsScreen> createState() => _RolePermissionsScreenState();
}

class _RolePermissionsScreenState extends State<RolePermissionsScreen> {
  late final Set<String> _selected = widget.role.permissions.toSet();
  bool get _protected => widget.role.code == 'DIRECTOR';

  Future<void> _save() async {
    final cubit = context.read<RolesCubit>();
    final affected = await cubit.affectedUsers(widget.role.id);
    if (!mounted) return;
    final confirmed = await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.rolePermissionsConfirmTitle.tr(),
      description: LocaleKeys.rolePermissionsAffected.tr(
        args: <String>[affected.toString()],
      ),
      confirmLabel: LocaleKeys.save.tr(),
      confirmIdentifier: 'role_permissions_confirm',
      cancelIdentifier: 'role_permissions_cancel',
    );
    if (!confirmed || !mounted) return;
    final ok = await cubit.setPermissions(widget.role.id, _selected);
    if (!mounted) return;
    if (ok) {
      showSuccessToast(LocaleKeys.rolePermissionsSaved.tr(), context);
      Navigator.pop(context);
    } else if (cubit.state is RolesReady) {
      showErrorToast((cubit.state as RolesReady).error ?? '', context);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.role.displayName)),
    body: BlocBuilder<RolesCubit, RolesState>(
      builder: (context, state) {
        if (state is! RolesReady) return const AppLoadingIndicator();
        return SafeArea(
          child: Column(
            children: <Widget>[
              if (_protected)
                MaterialBanner(
                  content: Text(LocaleKeys.roleSystemProtected.tr()),
                  actions: const <Widget>[SizedBox.shrink()],
                ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  children: state.groups.map((group) => Card(
                    child: ExpansionTile(
                      title: Text(group.label),
                      subtitle: Text(LocaleKeys.rolePermissionCount.tr(
                        args: <String>[
                          group.permissions.where((p) => _selected.contains(p.code)).length.toString(),
                        ],
                      )),
                      children: group.permissions.map((permission) => CheckboxListTile(
                        value: _selected.contains(permission.code),
                        title: Text(permission.displayName),
                        subtitle: permission.description == null
                            ? null
                            : Text(permission.description!),
                        onChanged: _protected || state.isSaving
                            ? null
                            : (checked) => setState(() {
                                checked == true
                                    ? _selected.add(permission.code)
                                    : _selected.remove(permission.code);
                              }),
                      )).toList(growable: false),
                    ),
                  )).toList(growable: false),
                ),
              ),
              if (!_protected)
                Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  child: FilledButton.icon(
                    onPressed: state.isSaving ? null : _save,
                    icon: const Icon(Icons.save_outlined),
                    label: Text(LocaleKeys.save.tr()),
                  ),
                ),
            ],
          ),
        );
      },
    ),
  );
}

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/params/role_write_params.dart';

class RoleFormResult {
  const RoleFormResult({required this.code, required this.translations});
  final String code;
  final RoleTranslations translations;
}

class RoleFormDialog extends StatefulWidget {
  const RoleFormDialog({this.role, super.key});
  final RoleEntity? role;

  static Future<RoleFormResult?> show(BuildContext context,
          {RoleEntity? role}) =>
      showDialog<RoleFormResult>(
        context: context,
        builder: (_) => RoleFormDialog(role: role),
      );

  @override
  State<RoleFormDialog> createState() => _RoleFormDialogState();
}

class _RoleFormDialogState extends State<RoleFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _code = TextEditingController(text: widget.role?.code);
  late final _arName = TextEditingController(
    text: widget.role?.translations['ar']?.displayName ??
        widget.role?.displayName,
  );
  late final _enName = TextEditingController(
    text: widget.role?.translations['en']?.displayName ??
        widget.role?.displayName,
  );
  late final _arDescription = TextEditingController(
    text: widget.role?.translations['ar']?.description,
  );
  late final _enDescription = TextEditingController(
    text: widget.role?.translations['en']?.description,
  );

  @override
  void dispose() {
    _code.dispose();
    _arName.dispose();
    _enName.dispose();
    _arDescription.dispose();
    _enDescription.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.pop(
      context,
      RoleFormResult(
        code: _code.text.trim().toUpperCase(),
        translations: RoleTranslations(
          arName: _arName.text,
          enName: _enName.text,
          arDescription: _arDescription.text,
          enDescription: _enDescription.text,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(
          widget.role == null
              ? LocaleKeys.roleCreate.tr()
              : LocaleKeys.roleEdit.tr(),
        ),
        content: SizedBox(
          width: 480,
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  if (widget.role == null)
                    TextFormField(
                      controller: _code,
                      textCapitalization: TextCapitalization.characters,
                      decoration:
                          InputDecoration(labelText: LocaleKeys.roleCode.tr()),
                      validator: (value) => RegExp(r'^[A-Z][A-Z0-9_]{1,49}$')
                              .hasMatch(value?.trim().toUpperCase() ?? '')
                          ? null
                          : LocaleKeys.roleCodeHint.tr(),
                    ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: _arName,
                    textDirection: TextDirection.rtl,
                    decoration: InputDecoration(
                        labelText: LocaleKeys.roleNameArabic.tr()),
                    validator: _required,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: _enName,
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                        labelText: LocaleKeys.roleNameEnglish.tr()),
                    validator: _required,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _arDescription,
                    textDirection: TextDirection.rtl,
                    decoration: InputDecoration(
                        labelText: LocaleKeys.roleDescriptionArabic.tr()),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _enDescription,
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                        labelText: LocaleKeys.roleDescriptionEnglish.tr()),
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: <Widget>[
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(LocaleKeys.cancel.tr())),
          FilledButton(onPressed: _submit, child: Text(LocaleKeys.save.tr())),
        ],
      );
}

String? _required(String? value) => value?.trim().isNotEmpty == true
    ? null
    : LocaleKeys.thisFieldIsRequired.tr();

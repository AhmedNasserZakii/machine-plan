class RoleTranslations {
  const RoleTranslations({
    required this.arName,
    required this.enName,
    this.arDescription,
    this.enDescription,
  });

  final String arName;
  final String enName;
  final String? arDescription;
  final String? enDescription;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'ar': <String, dynamic>{
          'displayName': arName.trim(),
          if (arDescription?.trim().isNotEmpty == true)
            'description': arDescription!.trim(),
        },
        'en': <String, dynamic>{
          'displayName': enName.trim(),
          if (enDescription?.trim().isNotEmpty == true)
            'description': enDescription!.trim(),
        },
      };
}

class CreateRoleParams {
  const CreateRoleParams({
    required this.code,
    required this.translations,
    required this.permissions,
  });

  final String code;
  final RoleTranslations translations;
  final List<String> permissions;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'code': code.trim().toUpperCase(),
        'translations': translations.toJson(),
        'permissions': permissions,
      };
}

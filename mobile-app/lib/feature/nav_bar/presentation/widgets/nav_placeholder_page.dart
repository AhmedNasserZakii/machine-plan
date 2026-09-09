import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';

/// Stands in for a tab whose feature has not been built yet. Each phase of the
/// roadmap replaces one of these with the real screen.
class NavPlaceholderPage extends StatelessWidget {
  const NavPlaceholderPage({required this.titleKey, super.key, this.icon});

  final String titleKey;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(titleKey.tr())),
      body: AppEmptyState(
        title: titleKey.tr(),
        subtitle: LocaleKeys.emptyStateSubtitle.tr(),
        icon: icon,
      ),
    );
  }
}

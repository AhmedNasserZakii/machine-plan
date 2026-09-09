import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';

/// Destination for entries whose feature has not shipped yet. It states that
/// plainly rather than showing an empty list, which would read as "no data"
/// and send a supervisor hunting for records that were never there.
class FeatureNotReadyScreen extends StatelessWidget {
  const FeatureNotReadyScreen({
    required this.titleKey,
    required this.icon,
    super.key,
  });

  final String titleKey;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(titleKey.tr())),
      body: AppEmptyState(
        icon: icon,
        title: LocaleKeys.featureNotReadyTitle.tr(),
        subtitle: LocaleKeys.featureNotReadySubtitle.tr(),
      ),
    );
  }
}

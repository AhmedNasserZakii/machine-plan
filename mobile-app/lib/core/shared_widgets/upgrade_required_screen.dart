import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/config/app_environment.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:url_launcher/url_launcher.dart';

/// Full-screen blocker shown after HTTP 426 / `CLIENT_UPGRADE_REQUIRED`.
/// There is no dismiss action — the only way out is updating the app.
class UpgradeRequiredScreen extends StatelessWidget {
  const UpgradeRequiredScreen({
    required this.message,
    this.minVersion,
    super.key,
  });

  final String message;
  final String? minVersion;

  Future<void> _openStore(BuildContext context) async {
    final storeUrl = AppEnvironment.storeUrl;
    if (storeUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(LocaleKeys.upgradeRequiredNoStore.tr())),
      );
      return;
    }
    final uri = Uri.parse(storeUrl);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(LocaleKeys.upgradeRequiredNoStore.tr())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const Spacer(),
                Icon(
                  Icons.system_update_alt_rounded,
                  size: 72,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  LocaleKeys.upgradeRequiredTitle.tr(),
                  style: theme.textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  message.trim().isNotEmpty
                      ? message
                      : LocaleKeys.upgradeRequiredMessage.tr(),
                  style: theme.textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                if (minVersion != null && minVersion!.isNotEmpty) ...<Widget>[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    LocaleKeys.upgradeRequiredMinVersion.tr(
                      args: <String>[minVersion!],
                    ),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                Text(
                  LocaleKeys.upgradeRequiredCurrentVersion.tr(
                    args: <String>[AppEnvironment.clientVersion],
                  ),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall,
                ),
                const Spacer(),
                FilledButton.icon(
                  onPressed: () => _openStore(context),
                  icon: const Icon(Icons.open_in_new),
                  label: Text(LocaleKeys.upgradeRequiredUpdate.tr()),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

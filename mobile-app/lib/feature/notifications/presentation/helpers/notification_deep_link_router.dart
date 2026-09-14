import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/presentation/pages/budgets_screen.dart';

/// Parsed `machinery://…` deep link from a push or in-app notification.
class ParsedNotificationDeepLink {
  const ParsedNotificationDeepLink({
    required this.host,
    required this.pathSegments,
    this.raw = '',
  });

  final String host;
  final List<String> pathSegments;
  final String raw;

  String? get entityId =>
      pathSegments.isEmpty ? null : pathSegments.last;

  static ParsedNotificationDeepLink? tryParse(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }

    final Uri? uri = Uri.tryParse(raw.trim());
    if (uri == null) {
      return null;
    }

    // Backend always sends `machinery://…`. Reject anything else so a bare
    // path does not silently route.
    if (uri.scheme.isNotEmpty && uri.scheme != 'machinery') {
      return null;
    }

    // `machinery://transfers/id` → host=transfers, path=/id
    // `machinery://finance/budgets/id` → host=finance, path=/budgets/id
    final String host = uri.host;
    final List<String> segments = uri.pathSegments
        .where((String s) => s.isNotEmpty)
        .toList(growable: false);

    if (host.isEmpty) {
      return null;
    }

    return ParsedNotificationDeepLink(
      host: host,
      pathSegments: segments,
      raw: raw.trim(),
    );
  }
}

/// Permission gate for a parsed deep link. Pure so unit tests can cover it.
String? requiredPermissionForDeepLink(ParsedNotificationDeepLink link) {
  switch (link.host) {
    case 'transfers':
      return P.transfersRead;
    case 'violations':
      return P.violationsRead;
    case 'maintenance':
      return P.maintenanceRead;
    case 'machines':
      return P.machinesRead;
    case 'finance':
      return P.financeRead;
    case 'subscriptions':
      return P.merchantsRead;
    case 'notifications':
      return null;
    default:
      return null;
  }
}

/// Routes a stored or tapped deep link after auth. Re-checks permissions so a
/// revoked grant never opens a detail the user cannot act on.
abstract class NotificationDeepLinkRouter {
  NotificationDeepLinkRouter._();

  static Future<void> consumePendingDeepLink(BuildContext context) async {
    final String pending = LocalStorage.getPendingDeepLink();
    if (pending.isEmpty) {
      return;
    }

    LocalStorage.deletePendingDeepLink();
    await open(context, pending);
  }

  static Future<void> open(BuildContext context, String? rawDeepLink) async {
    if (rawDeepLink == null || rawDeepLink.trim().isEmpty) {
      await AppRoute.goToNotificationsList(context: context);
      return;
    }

    final ParsedNotificationDeepLink? link =
        ParsedNotificationDeepLink.tryParse(rawDeepLink);

    if (link == null) {
      _fallback(context);
      return;
    }

    final PermissionService permissions = getIt<PermissionService>();
    final String? required = requiredPermissionForDeepLink(link);

    if (required != null && !permissions.has(required)) {
      _fallback(context);
      return;
    }

    switch (link.host) {
      case 'transfers':
        final String? id = link.entityId;
        if (id == null || id.isEmpty) {
          _fallback(context);
          return;
        }
        await AppRoute.goToTransferDetail(context: context, transferId: id);
        return;

      case 'violations':
        final String? id = link.entityId;
        if (id == null || id.isEmpty) {
          _fallback(context);
          return;
        }
        await AppRoute.goToViolationDetail(
          context: context,
          violationId: id,
        );
        return;

      case 'maintenance':
        final String? id = link.entityId;
        if (id == null || id.isEmpty) {
          _fallback(context);
          return;
        }
        await AppRoute.goToMaintenanceDetail(context: context, orderId: id);
        return;

      case 'machines':
        final String? id = link.entityId;
        if (id == null || id.isEmpty) {
          _fallback(context);
          return;
        }
        await AppRoute.goToMachineDetail(context: context, machineId: id);
        return;

      case 'finance':
        // `finance/budgets/{id}` — no budget detail route; open budgets list.
        if (link.pathSegments.isNotEmpty &&
            link.pathSegments.first == 'budgets') {
          if (!context.mounted) {
            return;
          }
          await Navigator.push<void>(
            context,
            MaterialPageRoute<void>(
              builder: (_) => const BudgetsScreen(query: FinanceQuery()),
            ),
          );
          return;
        }
        _fallback(context);
        return;

      case 'subscriptions':
        await AppRoute.goToMerchantsList(context: context);
        return;

      case 'notifications':
        await AppRoute.goToNotificationsList(context: context);
        return;

      default:
        _fallback(context);
    }
  }

  static void _fallback(BuildContext context) {
    if (!context.mounted) {
      return;
    }
    showErrorToast(LocaleKeys.notificationsDeepLinkUnavailable.tr(), context);
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';

/// What the unit cost and which invoice it came in on.
///
/// Wrapped in a permission gate as a whole: purchase price is finance data, and
/// a representative who can see the machine has no business seeing what the
/// company paid for it.
class MachinePurchaseCard extends StatelessWidget {
  const MachinePurchaseCard({required this.purchase, super.key});

  final MachinePurchase purchase;

  bool get _isEmpty =>
      purchase.price == null &&
      purchase.date == null &&
      purchase.invoiceNo == null;

  @override
  Widget build(BuildContext context) {
    if (_isEmpty) {
      return const SizedBox.shrink();
    }

    return PermissionGate(
      permission: P.reportsFinance,
      child: DetailCard(
        title: LocaleKeys.machinePurchaseTitle.tr(),
        icon: Icons.receipt_long_outlined,
        children: <Widget>[
          DetailRow(
            label: LocaleKeys.machinePurchasePrice.tr(),
            value: purchase.price == null
                ? null
                : Formatters.currency(purchase.price!),
          ),
          DetailRow(
            label: LocaleKeys.machinePurchaseDate.tr(),
            value: Formatters.isoDate(purchase.date),
          ),
          DetailRow(
            label: LocaleKeys.machineInvoiceNo.tr(),
            value: purchase.invoiceNo,
          ),
        ],
      ),
    );
  }
}

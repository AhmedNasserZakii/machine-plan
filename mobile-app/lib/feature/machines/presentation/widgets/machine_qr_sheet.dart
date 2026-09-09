import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// A large, on-screen QR of one machine's code (`8.2`).
///
/// Printing a replacement sticker is out of scope for the app (`12-feature-
/// qr-scanning.md`) — this is the substitute the spec asks for instead: when
/// a physical sticker is gone, a supervisor scans this screen from another
/// phone rather than the app growing a label printer integration it has no
/// use for anywhere else.
class MachineQrSheet extends StatelessWidget {
  const MachineQrSheet({required this.code, required this.serial, super.key});

  final String code;
  final String serial;

  static Future<void> show({
    required BuildContext context,
    required String code,
    required String serial,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => MachineQrSheet(code: code, serial: serial),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(LocaleKeys.machineQrTitle.tr(), style: Styles.s17(context)),
            const SizedBox(height: AppSpacing.lg),
            Container(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: QrImageView(
                data: code,
                size: 220,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            LtrText(
              serial,
              style: Styles.s15(context).copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              LocaleKeys.machineQrHint.tr(),
              textAlign: TextAlign.center,
              style: Styles.s12(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}

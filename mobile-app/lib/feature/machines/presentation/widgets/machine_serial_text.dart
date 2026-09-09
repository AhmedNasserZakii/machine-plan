import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// A serial, rendered left-to-right inside Arabic text and copyable on
/// long-press — people read these down the phone to someone at the warehouse,
/// and `SN-00341` shown as `341-00SN` would be dictated wrong.
class MachineSerialText extends StatelessWidget {
  const MachineSerialText(
    this.serial, {
    super.key,
    this.style,
    this.copyable = true,
  });

  final String serial;
  final TextStyle? style;
  final bool copyable;

  @override
  Widget build(BuildContext context) {
    final Widget text = LtrText(
      serial,
      style: style ?? Styles.mono(context),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );

    if (!copyable) {
      return text;
    }

    return GestureDetector(onLongPress: () => _copy(context), child: text);
  }

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: serial));

    if (!context.mounted) {
      return;
    }

    showSuccessToast(LocaleKeys.machineSerialCopied.tr(), context);
  }
}

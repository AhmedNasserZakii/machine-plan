import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';

/// Shown when the server refuses a signature because the document changed after
/// this screen loaded.
///
/// There is deliberately only one way out. Offering "sign anyway" would defeat
/// the check: a signature that was collected against one list and applied to
/// another is worse than no signature at all.
abstract class PayloadChangedDialog {
  static Future<void> show(BuildContext context) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: Text(LocaleKeys.transferPayloadChangedTitle.tr()),
        content: Text(LocaleKeys.transferPayloadChangedBody.tr()),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(LocaleKeys.transferReloadAndReview.tr()),
          ),
        ],
      ),
    );
  }
}

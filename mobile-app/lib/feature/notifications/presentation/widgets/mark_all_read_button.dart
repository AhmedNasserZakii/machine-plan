import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';

class MarkAllReadButton extends StatelessWidget {
  const MarkAllReadButton({
    required this.onPressed,
    this.enabled = true,
    this.isLoading = false,
    super.key,
  });

  final VoidCallback? onPressed;
  final bool enabled;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: enabled && !isLoading ? onPressed : null,
      tooltip: LocaleKeys.notificationsMarkAllRead.tr(),
      icon: Semantics(
        identifier: 'notifications_mark_all_read',
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.done_all_rounded),
      ),
    );
  }
}

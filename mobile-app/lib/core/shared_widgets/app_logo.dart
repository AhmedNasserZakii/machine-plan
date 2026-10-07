import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';

/// Shared brand artwork for authentication and the Flutter splash screen.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 168});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/app_logo.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      semanticLabel: LocaleKeys.appName.tr(),
    );
  }
}

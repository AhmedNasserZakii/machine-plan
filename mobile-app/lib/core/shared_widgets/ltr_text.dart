import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Renders serials, amounts, phone numbers and dates left-to-right even inside
/// Arabic text. Without this, `SN-00341` reads as `341-00SN`.
class LtrText extends StatelessWidget {
  const LtrText(
    this.text, {
    super.key,
    this.style,
    this.maxLines,
    this.overflow,
    this.textAlign,
  });

  final String text;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Text(
        text,
        style: style ?? Styles.mono(context),
        maxLines: maxLines,
        overflow: overflow,
        textAlign: textAlign,
      ),
    );
  }
}

import 'package:flutter/material.dart';

class ClickedWidget extends StatelessWidget {
  const ClickedWidget({super.key, this.child, this.onTap, this.borderRadius});

  final Widget? child;
  final void Function()? onTap;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      focusColor: Colors.transparent,
      splashColor: Colors.transparent,
      hoverColor: Colors.transparent,
      highlightColor: Colors.transparent,
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(borderRadius: borderRadius),
        child: child,
      ),
    );
  }
}

import 'package:flutter/material.dart';

/// Expands actions within the screen gutter, while remaining safe inside
/// intrinsically sized dialogs and horizontal toolbars.
class FullWidthAction extends StatelessWidget {
  const FullWidthAction({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SizedBox(
        width: constraints.hasBoundedWidth ? constraints.maxWidth : null,
        child: child,
      ),
    );
  }
}

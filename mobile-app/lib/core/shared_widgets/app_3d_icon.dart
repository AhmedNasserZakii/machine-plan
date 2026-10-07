import 'package:flutter/material.dart';

enum App3dIconType {
  home,
  machines,
  transfers,
  merchants,
  finance,
  more,
  reports,
  violations,
  myViolations,
  maintenance,
  checklist,
  users,
  branches,
  models,
  notifications,
  sync,
  language,
  password,
  logout,
  profile,
}

/// Full-color artwork: preserve the lighting and depth instead of tinting it.
class App3dIcon extends StatelessWidget {
  const App3dIcon(this.type, {super.key, this.size = 36, this.selected = true});

  final App3dIconType type;
  final double size;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: AnimatedScale(
        scale: selected ? 1 : 0.88,
        duration: const Duration(milliseconds: 180),
        child: AnimatedOpacity(
          opacity: selected ? 1 : 0.72,
          duration: const Duration(milliseconds: 180),
          child: Image.asset(
            'assets/icons/three_d/${type.name}.png',
            fit: BoxFit.contain,
            excludeFromSemantics: true,
            filterQuality: FilterQuality.medium,
          ),
        ),
      ),
    );
  }
}

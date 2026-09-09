import 'package:flutter/material.dart';

/// One bottom-bar destination. `permission` is null for tabs everyone gets.
class NavTab {
  const NavTab({
    required this.labelKey,
    required this.icon,
    required this.activeIcon,
    required this.pageBuilder,
    this.permission,
  });

  final String labelKey;
  final IconData icon;
  final IconData activeIcon;
  final Widget Function() pageBuilder;
  final String? permission;
}

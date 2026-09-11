import 'package:flutter/material.dart';

/// One bottom-bar destination. `permission` is null for tabs everyone gets.
class NavTab {
  const NavTab({
    required this.labelKey,
    required this.icon,
    required this.activeIcon,
    required this.pageBuilder,
    required this.identifier,
    this.permission,
  });

  final String labelKey;
  final IconData icon;
  final IconData activeIcon;
  final Widget Function() pageBuilder;
  final String? permission;

  /// Stable automation id. The label text alone is not reliably unique on
  /// screen — e.g. "المالية" also appears as a Home dashboard card title for
  /// anyone with finance.read, independent of whether the tab itself made
  /// the bottom bar's five-slot cap.
  final String identifier;
}

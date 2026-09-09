import 'package:flutter/material.dart';

class HomeQuickAction {
  const HomeQuickAction({
    required this.label,
    required this.icon,
    required this.onTap,
    required this.identifier,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  /// A stable key for driver/widget tests — the label alone is not, once it
  /// starts going through `.tr()`.
  final String identifier;
}

/// Permission-filtered action buttons. Renders nothing at all when [actions]
/// is empty rather than an empty section header, since a role with no create
/// permission (an auditor, a read-only accountant) is a real, expected case.
class HomeQuickActions extends StatelessWidget {
  const HomeQuickActions({required this.actions, super.key});

  final List<HomeQuickAction> actions;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: actions
          .map(
            (HomeQuickAction action) => FilledButton.tonalIcon(
              key: ValueKey<String>(action.identifier),
              onPressed: action.onTap,
              icon: Icon(action.icon),
              label: Text(action.label),
            ),
          )
          .toList(growable: false),
    );
  }
}

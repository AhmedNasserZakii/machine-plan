import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/home/presentation/widgets/home_quick_actions.dart';

Widget _wrap(Widget child, {TextDirection direction = TextDirection.ltr}) {
  return MaterialApp(
    home: Directionality(
      textDirection: direction,
      child: Scaffold(body: child),
    ),
  );
}

void main() {
  for (final TextDirection direction in TextDirection.values) {
    group(direction == TextDirection.rtl ? 'RTL' : 'LTR', () {
      testWidgets('a representative sees only the actions their permissions grant', (
        tester,
      ) async {
        // A representative typically holds `transfers.create` and
        // `merchants.create` but not `machines.create`/`finance.create` — the
        // screen builds this same filtered list from `PermissionService`
        // before ever constructing the widget, so the widget itself just
        // renders whatever list it is handed.
        int transferTaps = 0;
        int merchantTaps = 0;

        await tester.pumpWidget(
          _wrap(
            HomeQuickActions(
              actions: <HomeQuickAction>[
                HomeQuickAction(
                  identifier: 'create_transfer',
                  label: 'New transfer',
                  icon: Icons.swap_horiz_rounded,
                  onTap: () => transferTaps++,
                ),
                HomeQuickAction(
                  identifier: 'register_merchant',
                  label: 'Register merchant',
                  icon: Icons.storefront_rounded,
                  onTap: () => merchantTaps++,
                ),
              ],
            ),
            direction: direction,
          ),
        );

        expect(find.text('New transfer'), findsOneWidget);
        expect(find.text('Register merchant'), findsOneWidget);
        // A Director-only action never rendered in the first place.
        expect(find.text('Add transaction'), findsNothing);

        await tester.tap(find.text('New transfer'));
        await tester.tap(find.text('Register merchant'));
        await tester.pump();

        expect(transferTaps, 1);
        expect(merchantTaps, 1);
        expect(tester.takeException(), isNull);
      });

      testWidgets('a role with no create permission at all renders nothing', (
        tester,
      ) async {
        // An auditor/read-only accountant: every quick action was filtered
        // out before construction, so the section collapses to nothing
        // rather than an empty header.
        await tester.pumpWidget(
          _wrap(
            const HomeQuickActions(actions: <HomeQuickAction>[]),
            direction: direction,
          ),
        );

        expect(find.byType(FilledButton), findsNothing);
        expect(find.byType(SizedBox), findsWidgets);
        expect(tester.takeException(), isNull);
      });

      testWidgets('a Director sees every action', (tester) async {
        await tester.pumpWidget(
          _wrap(
            HomeQuickActions(
              actions: <HomeQuickAction>[
                HomeQuickAction(
                  identifier: 'scan',
                  label: 'Scan a code',
                  icon: Icons.qr_code_scanner_rounded,
                  onTap: () {},
                ),
                HomeQuickAction(
                  identifier: 'create_transfer',
                  label: 'New transfer',
                  icon: Icons.swap_horiz_rounded,
                  onTap: () {},
                ),
                HomeQuickAction(
                  identifier: 'register_merchant',
                  label: 'Register merchant',
                  icon: Icons.storefront_rounded,
                  onTap: () {},
                ),
                HomeQuickAction(
                  identifier: 'add_machine',
                  label: 'Register a machine',
                  icon: Icons.add_box_rounded,
                  onTap: () {},
                ),
                HomeQuickAction(
                  identifier: 'add_transaction',
                  label: 'Add transaction',
                  icon: Icons.receipt_long_rounded,
                  onTap: () {},
                ),
              ],
            ),
            direction: direction,
          ),
        );

        for (final String label in <String>[
          'Scan a code',
          'New transfer',
          'Register merchant',
          'Register a machine',
          'Add transaction',
        ]) {
          expect(find.text(label), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      });
    });
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/home/domain/entities/home_block.dart';
import 'package:machinery/feature/home/presentation/widgets/home_block_card.dart';

/// `HomeBlockCard` takes every string pre-resolved (see its doc comment), so
/// these tests never touch `easy_localization` — bootstrapping it inside a
/// widget test was tried first and hung for the full ten-minute test timeout
/// (no asset-bundle I/O completes inside the plain `flutter_test` binding),
/// which is also why nothing else in this suite does it. RTL is exercised the
/// same way `report_phone_layout_test.dart` exercises a phone viewport: wrap
/// the widget in the exact ambient condition being tested, nothing more.
Widget _wrap(Widget child, {TextDirection direction = TextDirection.ltr}) {
  return MaterialApp(
    home: Directionality(
      textDirection: direction,
      child: Scaffold(body: SizedBox(width: 160, height: 120, child: child)),
    ),
  );
}

void main() {
  for (final TextDirection direction in TextDirection.values) {
    group(direction == TextDirection.rtl ? 'RTL' : 'LTR', () {
      testWidgets('ready renders the value and the scope subtitle', (
        tester,
      ) async {
        await tester.pumpWidget(
          _wrap(
            const HomeBlockCard(
              title: 'Machines',
              icon: Icons.precision_manufacturing_rounded,
              color: Colors.blue,
              availability: HomeBlockAvailability.ready,
              offlineText: 'Unavailable offline',
              retryTooltip: 'Try again',
              valueText: '42',
              subtitle: 'In your scope',
            ),
            direction: direction,
          ),
        );

        expect(find.text('Machines'), findsOneWidget);
        expect(find.text('42'), findsOneWidget);
        expect(find.text('In your scope'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });

      testWidgets(
        'the last-updated caption replaces the subtitle rather than stacking under it '
        '(a v1 of this card stacked both and overflowed a real grid cell — caught here, not by eye)',
        (tester) async {
          await tester.pumpWidget(
            _wrap(
              const HomeBlockCard(
                title: 'Machines',
                icon: Icons.precision_manufacturing_rounded,
                color: Colors.blue,
                availability: HomeBlockAvailability.ready,
                offlineText: 'Unavailable offline',
                retryTooltip: 'Try again',
                valueText: '42',
                subtitle: 'In your scope',
                updatedCaption: 'Updated 3 minutes ago',
              ),
              direction: direction,
            ),
          );

          expect(find.text('Updated 3 minutes ago'), findsOneWidget);
          expect(find.text('In your scope'), findsNothing);
          expect(tester.takeException(), isNull);
        },
      );

      testWidgets('loading shows a spinner and no value', (tester) async {
        await tester.pumpWidget(
          _wrap(
            const HomeBlockCard(
              title: 'Transfers',
              icon: Icons.swap_horiz_rounded,
              color: Colors.orange,
              availability: HomeBlockAvailability.loading,
              offlineText: 'Unavailable offline',
              retryTooltip: 'Try again',
            ),
            direction: direction,
          ),
        );

        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expect(find.text('Transfers'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });

      testWidgets('offline shows the offline text, not a value or an error', (
        tester,
      ) async {
        await tester.pumpWidget(
          _wrap(
            const HomeBlockCard(
              title: 'Violations',
              icon: Icons.gavel_rounded,
              color: Colors.red,
              availability: HomeBlockAvailability.offline,
              offlineText: 'Unavailable offline',
              retryTooltip: 'Try again',
            ),
            direction: direction,
          ),
        );

        expect(find.text('Unavailable offline'), findsOneWidget);
        expect(find.byIcon(Icons.cloud_off_rounded), findsOneWidget);
        expect(find.byType(IconButton), findsNothing);
        expect(tester.takeException(), isNull);
      });

      testWidgets('error shows the message and retrying calls onRetry once', (
        tester,
      ) async {
        int retryCount = 0;

        await tester.pumpWidget(
          _wrap(
            HomeBlockCard(
              title: 'Finance',
              icon: Icons.account_balance_wallet_rounded,
              color: Colors.teal,
              availability: HomeBlockAvailability.error,
              offlineText: 'Unavailable offline',
              retryTooltip: 'Try again',
              errorMessage: 'Server unavailable',
              onRetry: () => retryCount++,
            ),
            direction: direction,
          ),
        );

        expect(find.text('Server unavailable'), findsOneWidget);
        await tester.tap(find.byIcon(Icons.refresh_rounded));
        await tester.pump();

        expect(retryCount, 1);
        expect(tester.takeException(), isNull);
      });

      testWidgets('tapping the card calls onTap', (tester) async {
        int tapCount = 0;

        await tester.pumpWidget(
          _wrap(
            HomeBlockCard(
              title: 'Merchants',
              icon: Icons.storefront_rounded,
              color: Colors.green,
              availability: HomeBlockAvailability.ready,
              offlineText: 'Unavailable offline',
              retryTooltip: 'Try again',
              valueText: '9',
              onTap: () => tapCount++,
            ),
            direction: direction,
          ),
        );

        await tester.tap(find.text('Merchants'));
        await tester.pump();

        expect(tapCount, 1);
      });
    });
  }
}

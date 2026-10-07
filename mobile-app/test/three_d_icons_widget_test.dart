import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/shared_widgets/app_3d_icon.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/feature/more/presentation/widgets/more_tile.dart';

void main() {
  testWidgets('every 3D icon loads from the bundled assets', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Wrap(
            children: [
              for (final icon in App3dIconType.values) App3dIcon(icon),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(Image), findsNWidgets(App3dIconType.values.length));
  });

  for (final direction in TextDirection.values) {
    testWidgets('empty state action remains usable in $direction', (
      tester,
    ) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Directionality(
            textDirection: direction,
            child: Scaffold(
              body: AppEmptyState(
                icon: Icons.point_of_sale_outlined,
                title: 'No machines / لا توجد ماكينات',
                subtitle: 'Add your first machine',
                action: FilledButton(
                  onPressed: () => tapped = true,
                  child: const Text('Add'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Add'));
      expect(tapped, isTrue);
    });
    testWidgets('settings badge and tap survive narrow $direction layout', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Directionality(
            textDirection: direction,
            child: Scaffold(
              body: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(1.6)),
                child: MoreTile(
                  icon: App3dIconType.notifications,
                  label: 'Notifications / الإشعارات',
                  badgeCount: 120,
                  onTap: () => tapped = true,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('99+'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Notifications / الإشعارات'));
      expect(tapped, isTrue);
    });
  }
}

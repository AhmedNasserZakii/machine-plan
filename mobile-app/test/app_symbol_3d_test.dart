import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/shared_widgets/app_3d_icon.dart';
import 'package:machinery/core/shared_widgets/app_symbol_3d.dart';

void main() {
  testWidgets('feature artwork and small controls fit both text directions', (
    tester,
  ) async {
    for (final direction in TextDirection.values) {
      await tester.pumpWidget(
        MaterialApp(
          home: Directionality(
            textDirection: direction,
            child: Scaffold(
              body: Wrap(
                children: [
                  for (final size in [14.0, 18.0, 24.0, 56.0]) ...[
                    AppSymbol3d(Icons.point_of_sale_outlined, size: size),
                    AppSymbol3d(Icons.arrow_back_rounded, size: size),
                    AppSymbol3d(
                      Icons.check_circle_rounded,
                      size: size,
                      color: Colors.green,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(App3dIcon), findsNWidgets(4));
      expect(find.byType(Icon), findsNothing);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets(
    'theme size, disabled opacity, label and action survive replacement',
    (tester) async {
      final semantics = tester.ensureSemantics();

      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IconTheme(
              data: const IconThemeData(
                size: 20,
                opacity: .4,
                color: Colors.blue,
              ),
              child: IconButton(
                onPressed: () => tapped = true,
                icon: const AppSymbol3d(
                  Icons.add_rounded,
                  semanticLabel: 'Add machine',
                ),
              ),
            ),
          ),
        ),
      );
      expect(find.bySemanticsLabel('Add machine'), findsOneWidget);
      final symbol = find.byType(AppSymbol3d);
      expect(tester.getSize(symbol), const Size(20, 20));
      expect(
        tester
            .widget<Opacity>(
              find.descendant(of: symbol, matching: find.byType(Opacity)),
            )
            .opacity,
        .4,
      );
      await tester.tap(symbol);
      expect(tapped, isTrue);
      semantics.dispose();
      expect(tester.takeException(), isNull);
    },
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/full_width_action.dart';
import 'package:machinery/feature/home/presentation/widgets/home_quick_actions.dart';

void main() {
  for (final direction in TextDirection.values) {
    testWidgets('actions fill a narrow screen in $direction', (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: Directionality(
            textDirection: direction,
            child: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      HomeQuickActions(
                        actions: [
                          HomeQuickAction(
                            label: 'تسجيل ماكينة جديدة',
                            icon: Icons.add,
                            identifier: 'new_machine',
                            onTap: () {},
                          ),
                          HomeQuickAction(
                            label: 'Create a new transfer',
                            icon: Icons.swap_horiz,
                            identifier: 'new_transfer',
                            onTap: () {},
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      MediaQuery(
                        data: const MediaQueryData(
                          textScaler: TextScaler.linear(2),
                        ),
                        child: CustomButton(
                          title:
                              'Save these changes and continue to the next screen',
                          isLoading: false,
                          onPressed: () {},
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      for (final button in find.byType(FilledButton).evaluate()) {
        expect(tester.getSize(find.byWidget(button.widget)).width, 288);
      }
      expect(tester.getSize(find.byType(ElevatedButton)).width, 288);
      expect(
        tester.getSize(find.byType(ElevatedButton)).height,
        greaterThan(56),
      );
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('full-width actions remain safe in a horizontal toolbar', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Row(
            children: [
              FullWidthAction(
                child: FilledButton(
                  onPressed: () {},
                  child: const Text('Retry'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
  });
}

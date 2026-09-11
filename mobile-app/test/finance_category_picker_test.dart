import 'package:dartz/dartz.dart';
import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/presentation/pages/category_picker_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('navigates four category levels on a phone viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues(<String, Object>{});
    LocalStorage.local = await SharedPreferences.getInstance();
    final leaf = _category('l4', 'Level four', 3);
    final level3 = _category('l3', 'Level three', 2, <FinanceCategory>[leaf]);
    final level2 = _category('l2', 'Level two', 1, <FinanceCategory>[level3]);
    final root = _category('l1', 'Level one', 0, <FinanceCategory>[level2]);
    await tester.pumpWidget(
      MaterialApp(
        home: CategoryPickerScreen(
          repo: _CategoryRepo(<FinanceCategory>[root]),
          kind: FinanceKind.expense,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Level one'), findsOneWidget);
    // Resolve the same way the widget does: .tr() isn't bootstrapped with real translations in
    // widget tests and falls back to the raw key, but calling it here too keeps this in sync
    // either way and disambiguates from the (also unnamed-tooltip) breadcrumb chevrons.
    await tester.tap(find.byTooltip(LocaleKeys.financeOpenSubcategories.tr()));
    await tester.pumpAndSettle();
    expect(find.text('Level two'), findsOneWidget);
    // Resolve the same way the widget does: .tr() isn't bootstrapped with real translations in
    // widget tests and falls back to the raw key, but calling it here too keeps this in sync
    // either way and disambiguates from the (also unnamed-tooltip) breadcrumb chevrons.
    await tester.tap(find.byTooltip(LocaleKeys.financeOpenSubcategories.tr()));
    await tester.pumpAndSettle();
    expect(find.text('Level three'), findsOneWidget);
    // Resolve the same way the widget does: .tr() isn't bootstrapped with real translations in
    // widget tests and falls back to the raw key, but calling it here too keeps this in sync
    // either way and disambiguates from the (also unnamed-tooltip) breadcrumb chevrons.
    await tester.tap(find.byTooltip(LocaleKeys.financeOpenSubcategories.tr()));
    await tester.pumpAndSettle();
    expect(find.text('Level four'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

FinanceCategory _category(
  String id,
  String name,
  int depth, [
  List<FinanceCategory> children = const <FinanceCategory>[],
]) => FinanceCategory(
  id: id,
  name: name,
  kind: FinanceKind.expense,
  depth: depth,
  isSystem: false,
  isActive: true,
  transactionCount: 0,
  directTotal: 0,
  rolledUpTotal: 0,
  children: children,
);

class _CategoryRepo implements FinanceRepo {
  _CategoryRepo(this.rows);
  final List<FinanceCategory> rows;
  @override
  Future<Either<ServerFailure, List<FinanceCategory>>> categories({
    FinanceKind? kind,
    bool includeInactive = false,
  }) async => Right(rows);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

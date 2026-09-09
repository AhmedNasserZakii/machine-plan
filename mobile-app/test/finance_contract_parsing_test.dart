import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/finance/data/models/finance_models.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';

void main() {
  group('finance API contracts', () {
    test('parses summary totals and counts', () {
      final summary = financeSummaryFromJson(<String, dynamic>{
        'period': <String, dynamic>{'from': '2026-09-01', 'to': '2026-09-30'},
        'income': <String, dynamic>{'total': 12000, 'count': 4},
        'expense': <String, dynamic>{'total': 7250.5, 'count': 9},
        'net': 4749.5,
      });
      expect(summary.income, 12000);
      expect(summary.expenseCount, 9);
      expect(summary.net, 4749.5);
    });

    test('parses immutable automatic transaction', () {
      final row = financeTransactionFromJson(<String, dynamic>{
        'id': 'tx-1',
        'referenceNo': 'EXP-2026-1',
        'kind': 'EXPENSE',
        'amount': 500,
        'category': <String, dynamic>{
          'id': 'c1',
          'name': 'Fines',
          'path': 'Operations / Fines',
        },
        'transactionDate': '2026-09-08',
        'paymentMethod': <String, dynamic>{'id': 'p1', 'name': 'Cash'},
        'source': 'AUTO_VIOLATION',
        'isVoided': false,
        'isEditable': false,
        'isVoidable': false,
      });
      expect(row.isAutomatic, isTrue);
      expect(row.isEditable, isFalse);
      expect(row.category.path, 'Operations / Fines');
    });

    test('parses direct and rolled-up breakdown with budget state', () {
      final report = financeBreakdownFromJson(<String, dynamic>{
        'period': <String, dynamic>{'from': '2026-09-01', 'to': '2026-09-30'},
        'grandTotal': 1000,
        'categories': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'root',
            'name': 'Operations',
            'depth': 0,
            'directTotal': 100,
            'rolledUpTotal': 1000,
            'transactionCount': 1,
            'rolledUpCount': 5,
            'percentOfGrandTotal': 100,
            'percentOfParent': null,
            'budget': <String, dynamic>{
              'amount': 900,
              'usedPercent': 111.1,
              'status': 'EXCEEDED',
            },
            'children': <dynamic>[],
          },
        ],
      });
      expect(report.categories.single.directTotal, 100);
      expect(report.categories.single.rolledUpTotal, 1000);
      expect(report.categories.single.budget!.status, BudgetStatus.exceeded);
    });

    test('serializes list filters and excludes immutable fields on update', () {
      final query = TransactionQuery(
        kind: FinanceKind.income,
        dateFrom: DateTime(2026, 9, 1),
        dateTo: DateTime(2026, 9, 8),
        sources: const <String>['MANUAL'],
        includeVoided: true,
      );
      expect(query.toQuery(), containsPair('kind', 'INCOME'));
      expect(query.toQuery(), containsPair('dateFrom', '2026-09-01'));
      final draft = TransactionDraft(
        kind: FinanceKind.expense,
        amount: 10,
        categoryId: 'c',
        transactionDate: DateTime(2026, 9, 8),
        paymentMethodId: 'p',
        branchId: 'b',
      );
      expect(draft.toJson(forUpdate: true).containsKey('kind'), isFalse);
      expect(draft.toJson(forUpdate: true).containsKey('branchId'), isFalse);
    });
  });
}

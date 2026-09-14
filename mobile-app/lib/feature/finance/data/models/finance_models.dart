import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';

double _money(Object? value) => value is num ? value.toDouble() : 0;
int _integer(Object? value) => value is num ? value.toInt() : 0;
DateTime _date(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ?? DateTime(1970);
Map<String, dynamic> _map(Object? value) =>
    value is Map<String, dynamic> ? value : const <String, dynamic>{};
List<Map<String, dynamic>> _maps(Object? value) => value is List
    ? value.whereType<Map<String, dynamic>>().toList(growable: false)
    : const <Map<String, dynamic>>[];

FinanceRef financeRefFromJson(Object? raw) {
  final Map<String, dynamic> json = _map(raw);
  return FinanceRef(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    path: json['path']?.toString() ?? '',
  );
}

FinancePeriod financePeriodFromJson(Object? raw) {
  final Map<String, dynamic> json = _map(raw);
  return FinancePeriod(from: _date(json['from']), to: _date(json['to']));
}

FinanceSummary financeSummaryFromJson(Map<String, dynamic> json) {
  final Map<String, dynamic> income = _map(json['income']);
  final Map<String, dynamic> expense = _map(json['expense']);
  return FinanceSummary(
    period: financePeriodFromJson(json['period']),
    income: _money(income['total']),
    expense: _money(expense['total']),
    net: _money(json['net']),
    incomeCount: _integer(income['count']),
    expenseCount: _integer(expense['count']),
  );
}

FinanceTransaction financeTransactionFromJson(Map<String, dynamic> json) {
  return FinanceTransaction(
    id: json['id']?.toString() ?? '',
    referenceNo: json['referenceNo']?.toString() ?? '',
    kind: FinanceKind.fromJson(json['kind']),
    amount: _money(json['amount']),
    category: financeRefFromJson(json['category']),
    transactionDate: _date(json['transactionDate']),
    paymentMethod: financeRefFromJson(json['paymentMethod']),
    branch: json['branch'] == null ? null : financeRefFromJson(json['branch']),
    supplier: json['supplier'] == null
        ? null
        : financeRefFromJson(json['supplier']),
    notes: json['notes'] as String?,
    invoiceMediaId: json['invoiceMediaId'] as String?,
    source: json['source']?.toString() ?? 'MANUAL',
    isVoided: json['isVoided'] as bool? ?? false,
    voidReason: json['voidReason'] as String?,
    isEditable: json['isEditable'] as bool? ?? false,
    isVoidable: json['isVoidable'] as bool? ?? false,
  );
}

FinanceCategory financeCategoryFromJson(Map<String, dynamic> json) {
  return FinanceCategory(
    id: json['id']?.toString() ?? '',
    code: json['code'] as String?,
    name: json['name']?.toString() ?? '',
    description: json['description'] as String?,
    parentId: json['parentId'] as String?,
    kind: FinanceKind.fromJson(json['kind']),
    depth: _integer(json['depth']),
    isSystem: json['isSystem'] as bool? ?? false,
    isActive: json['isActive'] as bool? ?? true,
    sortOrder: _integer(json['sortOrder']),
    transactionCount: _integer(json['transactionCount']),
    directTotal: _money(json['totalAmount'] ?? json['directTotal']),
    rolledUpTotal: _money(json['rolledUpTotal']),
    children: _maps(
      json['children'],
    ).map(financeCategoryFromJson).toList(growable: false),
  );
}

BudgetUsage? budgetUsageFromJson(Object? raw) {
  if (raw == null) return null;
  final Map<String, dynamic> json = _map(raw);
  return BudgetUsage(
    amount: _money(json['amount']),
    usedPercent: _money(json['usedPercent']),
    status: BudgetStatus.fromJson(json['status']),
  );
}

CategoryBreakdown categoryBreakdownFromJson(Map<String, dynamic> json) {
  return CategoryBreakdown(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    depth: _integer(json['depth']),
    directTotal: _money(json['directTotal']),
    rolledUpTotal: _money(json['rolledUpTotal']),
    transactionCount: _integer(json['transactionCount']),
    rolledUpCount: _integer(json['rolledUpCount']),
    percentOfGrandTotal: _money(json['percentOfGrandTotal']),
    percentOfParent: json['percentOfParent'] == null
        ? null
        : _money(json['percentOfParent']),
    budget: budgetUsageFromJson(json['budget']),
    children: _maps(
      json['children'],
    ).map(categoryBreakdownFromJson).toList(growable: false),
  );
}

FinanceBreakdown financeBreakdownFromJson(Map<String, dynamic> json) =>
    FinanceBreakdown(
      period: financePeriodFromJson(json['period']),
      grandTotal: _money(json['grandTotal']),
      categories: _maps(
        json['categories'],
      ).map(categoryBreakdownFromJson).toList(growable: false),
    );

FinanceBudget financeBudgetFromJson(Map<String, dynamic> json) => FinanceBudget(
  id: json['id']?.toString() ?? '',
  category: financeRefFromJson(json['category']),
  branch: json['branch'] == null ? null : financeRefFromJson(json['branch']),
  periodType: json['periodType']?.toString() ?? 'MONTHLY',
  periodStart: _date(json['periodStart']),
  periodEnd: _date(json['periodEnd']),
  amount: _money(json['amount']),
  alertThresholdPercent: _integer(json['alertThresholdPercent']),
  includeSubcategories: json['includeSubcategories'] as bool? ?? true,
  autoRenew: json['autoRenew'] as bool? ?? false,
  isActive: json['isActive'] as bool? ?? true,
);

FinanceBudgetStatus financeBudgetStatusFromJson(Map<String, dynamic> json) {
  final Map<String, dynamic> period = _map(json['period']);
  final Map<String, dynamic> pace = _map(json['pace']);
  return FinanceBudgetStatus(
    id: json['id']?.toString() ?? '',
    category: financeRefFromJson(json['category']),
    branch: json['branch'] == null ? null : financeRefFromJson(json['branch']),
    amount: _money(json['amount']),
    spent: _money(json['spent']),
    remaining: _money(json['remaining']),
    usedPercent: _money(json['usedPercent']),
    status: BudgetStatus.fromJson(json['status']),
    elapsedPercent: _money(period['elapsedPercent']),
    projectedTotal: _money(pace['projectedTotal']),
    overPaceBy: _money(pace['overPaceBy']),
  );
}

/// `GET /finance/budgets/status` now returns a paged array; each item carries
/// its own `asOf`. The old `{ asOf, budgets, summary }` envelope is still
/// accepted so a cached payload from before the change does not crash.
BudgetStatusList budgetStatusListFromJson(Object? raw) {
  if (raw is List) {
    final List<Map<String, dynamic>> rows = raw
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
    return BudgetStatusList(
      asOf: rows.isEmpty ? DateTime.now() : _date(rows.first['asOf']),
      budgets: rows.map(financeBudgetStatusFromJson).toList(growable: false),
    );
  }

  final Map<String, dynamic> json = _map(raw);
  return BudgetStatusList(
    asOf: _date(json['asOf']),
    budgets: _maps(
      json['budgets'],
    ).map(financeBudgetStatusFromJson).toList(growable: false),
  );
}

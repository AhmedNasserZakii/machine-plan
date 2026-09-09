import 'package:equatable/equatable.dart';

enum FinanceKind {
  expense,
  income;

  String get apiValue => name.toUpperCase();
  static FinanceKind fromJson(Object? value) =>
      value == 'INCOME' ? income : expense;
}

enum BudgetStatus {
  ok,
  warning,
  exceeded;

  static BudgetStatus fromJson(Object? value) => switch (value) {
    'WARNING' => warning,
    'EXCEEDED' => exceeded,
    _ => ok,
  };
}

class FinanceRef extends Equatable {
  const FinanceRef({required this.id, required this.name, this.path = ''});
  final String id;
  final String name;
  final String path;
  @override
  List<Object?> get props => <Object?>[id, name, path];
}

class FinancePeriod extends Equatable {
  const FinancePeriod({required this.from, required this.to});
  final DateTime from;
  final DateTime to;
  @override
  List<Object?> get props => <Object?>[from, to];
}

class FinanceSummary extends Equatable {
  const FinanceSummary({
    required this.period,
    required this.income,
    required this.expense,
    required this.net,
    required this.incomeCount,
    required this.expenseCount,
  });
  final FinancePeriod period;
  final double income;
  final double expense;
  final double net;
  final int incomeCount;
  final int expenseCount;
  @override
  List<Object?> get props => <Object?>[
    period,
    income,
    expense,
    net,
    incomeCount,
    expenseCount,
  ];
}

class FinanceTransaction extends Equatable {
  const FinanceTransaction({
    required this.id,
    required this.referenceNo,
    required this.kind,
    required this.amount,
    required this.category,
    required this.transactionDate,
    required this.paymentMethod,
    required this.source,
    required this.isVoided,
    required this.isEditable,
    required this.isVoidable,
    this.branch,
    this.supplier,
    this.notes,
    this.invoiceMediaId,
    this.voidReason,
    this.isPendingSync = false,
  });
  final String id;
  final String referenceNo;
  final FinanceKind kind;
  final double amount;
  final FinanceRef category;
  final DateTime transactionDate;
  final FinanceRef paymentMethod;
  final FinanceRef? branch;
  final FinanceRef? supplier;
  final String? notes;
  final String? invoiceMediaId;
  final String source;
  final bool isVoided;
  final String? voidReason;
  final bool isEditable;
  final bool isVoidable;
  final bool isPendingSync;
  bool get isAutomatic => source != 'MANUAL';
  @override
  List<Object?> get props => <Object?>[
    id,
    referenceNo,
    kind,
    amount,
    category,
    transactionDate,
    paymentMethod,
    branch,
    supplier,
    notes,
    invoiceMediaId,
    source,
    isVoided,
    voidReason,
    isEditable,
    isVoidable,
    isPendingSync,
  ];
}

class FinanceCategory extends Equatable {
  const FinanceCategory({
    required this.id,
    required this.name,
    required this.kind,
    required this.depth,
    required this.isSystem,
    required this.isActive,
    required this.transactionCount,
    required this.directTotal,
    required this.rolledUpTotal,
    this.code,
    this.description,
    this.parentId,
    this.sortOrder = 0,
    this.children = const <FinanceCategory>[],
  });
  final String id;
  final String? code;
  final String name;
  final String? description;
  final String? parentId;
  final FinanceKind kind;
  final int depth;
  final bool isSystem;
  final bool isActive;
  final int sortOrder;
  final int transactionCount;
  final double directTotal;
  final double rolledUpTotal;
  final List<FinanceCategory> children;
  Iterable<FinanceCategory> get flattened sync* {
    yield this;
    for (final FinanceCategory child in children) {
      yield* child.flattened;
    }
  }

  @override
  List<Object?> get props => <Object?>[
    id,
    code,
    name,
    description,
    parentId,
    kind,
    depth,
    isSystem,
    isActive,
    sortOrder,
    transactionCount,
    directTotal,
    rolledUpTotal,
    children,
  ];
}

class CategoryBreakdown extends Equatable {
  const CategoryBreakdown({
    required this.id,
    required this.name,
    required this.depth,
    required this.directTotal,
    required this.rolledUpTotal,
    required this.transactionCount,
    required this.rolledUpCount,
    required this.percentOfGrandTotal,
    this.percentOfParent,
    this.budget,
    this.children = const <CategoryBreakdown>[],
  });
  final String id;
  final String name;
  final int depth;
  final double directTotal;
  final double rolledUpTotal;
  final int transactionCount;
  final int rolledUpCount;
  final double percentOfGrandTotal;
  final double? percentOfParent;
  final BudgetUsage? budget;
  final List<CategoryBreakdown> children;
  @override
  List<Object?> get props => <Object?>[
    id,
    name,
    depth,
    directTotal,
    rolledUpTotal,
    transactionCount,
    rolledUpCount,
    percentOfGrandTotal,
    percentOfParent,
    budget,
    children,
  ];
}

class FinanceBreakdown extends Equatable {
  const FinanceBreakdown({
    required this.period,
    required this.grandTotal,
    required this.categories,
  });
  final FinancePeriod period;
  final double grandTotal;
  final List<CategoryBreakdown> categories;
  @override
  List<Object?> get props => <Object?>[period, grandTotal, categories];
}

class BudgetUsage extends Equatable {
  const BudgetUsage({
    required this.amount,
    required this.usedPercent,
    required this.status,
  });
  final double amount;
  final double usedPercent;
  final BudgetStatus status;
  @override
  List<Object?> get props => <Object?>[amount, usedPercent, status];
}

class FinanceBudget extends Equatable {
  const FinanceBudget({
    required this.id,
    required this.category,
    required this.periodType,
    required this.periodStart,
    required this.periodEnd,
    required this.amount,
    required this.alertThresholdPercent,
    required this.includeSubcategories,
    required this.autoRenew,
    required this.isActive,
    this.branch,
  });
  final String id;
  final FinanceRef category;
  final FinanceRef? branch;
  final String periodType;
  final DateTime periodStart;
  final DateTime periodEnd;
  final double amount;
  final int alertThresholdPercent;
  final bool includeSubcategories;
  final bool autoRenew;
  final bool isActive;
  @override
  List<Object?> get props => <Object?>[
    id,
    category,
    branch,
    periodType,
    periodStart,
    periodEnd,
    amount,
    alertThresholdPercent,
    includeSubcategories,
    autoRenew,
    isActive,
  ];
}

class FinanceBudgetStatus extends Equatable {
  const FinanceBudgetStatus({
    required this.id,
    required this.category,
    required this.amount,
    required this.spent,
    required this.remaining,
    required this.usedPercent,
    required this.status,
    required this.elapsedPercent,
    required this.projectedTotal,
    required this.overPaceBy,
    this.branch,
  });
  final String id;
  final FinanceRef category;
  final FinanceRef? branch;
  final double amount;
  final double spent;
  final double remaining;
  final double usedPercent;
  final BudgetStatus status;
  final double elapsedPercent;
  final double projectedTotal;
  final double overPaceBy;
  @override
  List<Object?> get props => <Object?>[
    id,
    category,
    branch,
    amount,
    spent,
    remaining,
    usedPercent,
    status,
    elapsedPercent,
    projectedTotal,
    overPaceBy,
  ];
}

class BudgetStatusList extends Equatable {
  const BudgetStatusList({required this.asOf, required this.budgets});
  final DateTime asOf;
  final List<FinanceBudgetStatus> budgets;
  int get warningCount =>
      budgets.where((b) => b.status == BudgetStatus.warning).length;
  int get exceededCount =>
      budgets.where((b) => b.status == BudgetStatus.exceeded).length;
  @override
  List<Object?> get props => <Object?>[asOf, budgets];
}

import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';

String financeDate(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

class FinanceQuery {
  const FinanceQuery({this.dateFrom, this.dateTo, this.branchId});
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final String? branchId;
  Map<String, dynamic> toQuery() => <String, dynamic>{
    if (dateFrom != null) 'dateFrom': financeDate(dateFrom!),
    if (dateTo != null) 'dateTo': financeDate(dateTo!),
    if (branchId != null) 'branchId': branchId,
  };
}

class TransactionQuery extends FinanceQuery {
  const TransactionQuery({
    super.dateFrom,
    super.dateTo,
    super.branchId,
    this.page = 1,
    this.kind,
    this.categoryId,
    this.search,
    this.minAmount,
    this.maxAmount,
    this.sources = const <String>[],
    this.includeVoided = false,
  });
  final int page;
  final FinanceKind? kind;
  final String? categoryId;
  final String? search;
  final double? minAmount;
  final double? maxAmount;
  final List<String> sources;
  final bool includeVoided;
  @override
  Map<String, dynamic> toQuery() => <String, dynamic>{
    ...super.toQuery(),
    'page': page,
    'limit': 20,
    if (kind != null) 'kind': kind!.apiValue,
    if (categoryId != null) 'categoryId': categoryId,
    if (search?.trim().isNotEmpty ?? false) 'search': search!.trim(),
    if (minAmount != null) 'minAmount': minAmount,
    if (maxAmount != null) 'maxAmount': maxAmount,
    if (sources.isNotEmpty) 'source': sources,
    if (includeVoided) 'includeVoided': true,
  };
  TransactionQuery copyWith({
    int? page,
    FinanceKind? kind,
    bool clearKind = false,
    String? categoryId,
    bool clearCategory = false,
    String? search,
    DateTime? dateFrom,
    DateTime? dateTo,
    String? branchId,
    double? minAmount,
    double? maxAmount,
    List<String>? sources,
    bool? includeVoided,
  }) => TransactionQuery(
    page: page ?? this.page,
    kind: clearKind ? null : kind ?? this.kind,
    categoryId: clearCategory ? null : categoryId ?? this.categoryId,
    search: search ?? this.search,
    dateFrom: dateFrom ?? this.dateFrom,
    dateTo: dateTo ?? this.dateTo,
    branchId: branchId ?? this.branchId,
    minAmount: minAmount ?? this.minAmount,
    maxAmount: maxAmount ?? this.maxAmount,
    sources: sources ?? this.sources,
    includeVoided: includeVoided ?? this.includeVoided,
  );
}

class TransactionDraft {
  const TransactionDraft({
    required this.kind,
    required this.amount,
    required this.categoryId,
    required this.transactionDate,
    required this.paymentMethodId,
    this.branchId,
    this.supplierId,
    this.invoiceMediaId,
    this.notes,
    this.clientUuid,
  });
  final FinanceKind kind;
  final double amount;
  final String categoryId;
  final DateTime transactionDate;
  final String paymentMethodId;
  final String? branchId;
  final String? supplierId;
  final String? invoiceMediaId;
  final String? notes;
  final String? clientUuid;
  Map<String, dynamic> toJson({bool forUpdate = false}) => <String, dynamic>{
    if (!forUpdate) 'kind': kind.apiValue,
    'amount': amount,
    'categoryId': categoryId,
    'transactionDate': financeDate(transactionDate),
    'paymentMethodId': paymentMethodId,
    if (!forUpdate && branchId != null) 'branchId': branchId,
    if (supplierId != null) 'supplierId': supplierId,
    if (invoiceMediaId != null) 'invoiceMediaId': invoiceMediaId,
    if (notes?.trim().isNotEmpty ?? false) 'notes': notes!.trim(),
    if (!forUpdate && clientUuid != null) 'clientUuid': clientUuid,
  };
  factory TransactionDraft.fromJson(Map<String, dynamic> json) =>
      TransactionDraft(
        kind: FinanceKind.fromJson(json['kind']),
        amount: (json['amount'] as num).toDouble(),
        categoryId: json['categoryId'] as String,
        transactionDate: DateTime.parse(json['transactionDate'] as String),
        paymentMethodId: json['paymentMethodId'] as String,
        branchId: json['branchId'] as String?,
        supplierId: json['supplierId'] as String?,
        invoiceMediaId: json['invoiceMediaId'] as String?,
        notes: json['notes'] as String?,
        clientUuid: json['clientUuid'] as String?,
      );
}

class CategoryDraft {
  const CategoryDraft({
    required this.nameAr,
    required this.nameEn,
    required this.kind,
    this.parentId,
    this.descriptionAr,
    this.descriptionEn,
    this.sortOrder = 0,
  });
  final String nameAr, nameEn;
  final String? descriptionAr, descriptionEn, parentId;
  final FinanceKind kind;
  final int sortOrder;
  Map<String, dynamic> toJson() => <String, dynamic>{
    if (parentId != null) 'parentId': parentId,
    'kind': kind.apiValue,
    'translations': <String, dynamic>{
      'ar': <String, dynamic>{
        'name': nameAr,
        if (descriptionAr != null) 'description': descriptionAr,
      },
      'en': <String, dynamic>{
        'name': nameEn,
        if (descriptionEn != null) 'description': descriptionEn,
      },
    },
    'sortOrder': sortOrder,
  };
}

class BudgetDraft {
  const BudgetDraft({
    required this.categoryId,
    required this.periodType,
    required this.periodStart,
    required this.periodEnd,
    required this.amount,
    this.branchId,
    this.alertThresholdPercent = 80,
    this.includeSubcategories = true,
    this.autoRenew = false,
  });
  final String categoryId, periodType;
  final String? branchId;
  final DateTime periodStart, periodEnd;
  final double amount;
  final int alertThresholdPercent;
  final bool includeSubcategories, autoRenew;
  Map<String, dynamic> toJson({bool forUpdate = false}) => <String, dynamic>{
    if (!forUpdate) 'categoryId': categoryId,
    if (!forUpdate && branchId != null) 'branchId': branchId,
    if (!forUpdate) 'periodType': periodType,
    if (!forUpdate) 'periodStart': financeDate(periodStart),
    if (!forUpdate) 'periodEnd': financeDate(periodEnd),
    'amount': amount,
    'alertThresholdPercent': alertThresholdPercent,
    'includeSubcategories': includeSubcategories,
    'autoRenew': autoRenew,
  };
}

import 'dart:convert';

import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/paginated_fetch.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/services/sync/finance_sync_queue.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/local_storage/local_storage_constant_keys.dart';
import 'package:machinery/feature/finance/data/models/finance_models.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:uuid/uuid.dart';

class FinanceRepoImpl implements FinanceRepo {
  FinanceRepoImpl({
    required this.apiService,
    required this.networkInfo,
    required this.queue,
  });
  final ApiService apiService;
  final NetworkInfo networkInfo;
  final FinanceSyncQueue queue;

  @override
  Future<Either<ServerFailure, FinanceSummary>> summary(FinanceQuery query) =>
      _guard(
        'summary',
        () async => financeSummaryFromJson(
          _data(
            (await apiService.client().get<dynamic>(
              WebConstant.financeSummary,
              queryParameters: query.toQuery(),
            )).data,
          ),
        ),
      );

  @override
  Future<Either<ServerFailure, BudgetStatusList>> budgetStatus(
    FinanceQuery query,
  ) => _guard(
    'budgetStatus',
    () async => budgetStatusListFromJson(
      await PaginatedFetch.all(
        client: apiService.client(),
        path: WebConstant.financeBudgetsStatus,
        extraQuery: _budgetStatusQuery(query),
      ),
    ),
  );

  @override
  Future<Either<ServerFailure, FinanceTransactionsPage>> transactions(
    TransactionQuery query,
  ) => _guard('transactions', () async {
    final Map<String, dynamic> body = _body(
      (await apiService.client().get<dynamic>(
        WebConstant.financeTransactions,
        queryParameters: query.toQuery(),
      )).data,
    );
    return FinanceTransactionsPage(
      items: _list(
        body['data'],
      ).map(financeTransactionFromJson).toList(growable: false),
      meta: PaginationMetaModel.fromJson(_map(body['meta'])),
    );
  });

  @override
  Future<Either<ServerFailure, FinanceTransaction>> transaction(String id) =>
      _guard(
        'transaction',
        () async => financeTransactionFromJson(
          _data(
            (await apiService.client().get<dynamic>(
              WebConstant.financeTransaction(id),
            )).data,
          ),
        ),
      );

  @override
  Future<Either<ServerFailure, FinanceTransaction>> createTransaction(
    TransactionDraft draft,
  ) async {
    final String clientUuid = draft.clientUuid ?? const Uuid().v4();
    final TransactionDraft replayable = TransactionDraft(
      kind: draft.kind,
      amount: draft.amount,
      categoryId: draft.categoryId,
      transactionDate: draft.transactionDate,
      paymentMethodId: draft.paymentMethodId,
      branchId: draft.branchId,
      supplierId: draft.supplierId,
      invoiceMediaId: draft.invoiceMediaId,
      notes: draft.notes,
      clientUuid: clientUuid,
    );
    if (!await networkInfo.isConnected) {
      await queue.add(replayable);
      return Right(
        FinanceTransaction(
          id: clientUuid,
          referenceNo: '',
          kind: replayable.kind,
          amount: replayable.amount,
          category: FinanceRef(id: replayable.categoryId, name: ''),
          transactionDate: replayable.transactionDate,
          paymentMethod: FinanceRef(id: replayable.paymentMethodId, name: ''),
          source: 'MANUAL',
          isVoided: false,
          isEditable: false,
          isVoidable: false,
          notes: replayable.notes,
          isPendingSync: true,
        ),
      );
    }
    final Either<ServerFailure, FinanceTransaction> result = await _guard(
      'createTransaction',
      () async => financeTransactionFromJson(
        _data(
          (await apiService.client().post<dynamic>(
            WebConstant.financeTransactions,
            data: replayable.toJson(),
          )).data,
        ),
      ),
      checkConnection: false,
    );
    return result.fold((ServerFailure failure) async {
      if (failure is OfflineFailure) {
        await queue.add(replayable);
        return Right(_pendingTransaction(replayable));
      }
      return Left(failure);
    }, (FinanceTransaction row) async => Right(row));
  }

  @override
  Future<Either<ServerFailure, FinanceTransaction>> updateTransaction(
    String id,
    TransactionDraft draft,
  ) => _guard(
    'updateTransaction',
    () async => financeTransactionFromJson(
      _data(
        (await apiService.client().patch<dynamic>(
          WebConstant.financeTransaction(id),
          data: draft.toJson(forUpdate: true),
        )).data,
      ),
    ),
  );

  @override
  Future<Either<ServerFailure, FinanceTransaction>> voidTransaction(
    String id,
    String reason,
  ) => _guard(
    'voidTransaction',
    () async => financeTransactionFromJson(
      _data(
        (await apiService.client().post<dynamic>(
          WebConstant.financeTransactionVoid(id),
          data: <String, dynamic>{'reason': reason},
        )).data,
      ),
    ),
  );

  @override
  Future<int> flushPendingTransactions() async {
    if (!await networkInfo.isConnected) return 0;
    int synced = 0;
    for (final TransactionDraft draft in queue.all()) {
      try {
        await apiService.client().post<dynamic>(
          WebConstant.financeTransactions,
          data: draft.toJson(),
        );
        await queue.remove(draft.clientUuid!);
        synced++;
      } on DioException {
        break;
      }
    }
    return synced;
  }

  @override
  Future<Either<ServerFailure, List<FinanceCategory>>> categories({
    FinanceKind? kind,
    bool includeInactive = false,
  }) async {
    final String cacheKey = kind == FinanceKind.income
        ? StorageKeys.financeIncomeCategories
        : StorageKeys.financeExpenseCategories;
    if (!await networkInfo.isConnected) {
      return _cachedCategories(cacheKey);
    }
    final result = await _guard('categories', () async {
      final Object? raw = _rawData(
        (await apiService.client().get<dynamic>(
          WebConstant.financeCategoriesTree,
          queryParameters: <String, dynamic>{
            if (kind != null) 'kind': kind.apiValue,
            if (includeInactive) 'includeInactive': true,
          },
        )).data,
      );
      await LocalStorage.local?.setString(cacheKey, json.encode(raw));
      return _list(raw).map(financeCategoryFromJson).toList(growable: false);
    }, checkConnection: false);
    return result.fold(
      (failure) => failure is OfflineFailure
          ? _cachedCategories(cacheKey)
          : Left(failure),
      Right.new,
    );
  }

  @override
  Future<Either<ServerFailure, FinanceCategory>> createCategory(
    CategoryDraft draft,
  ) => _guard(
    'createCategory',
    () async => financeCategoryFromJson(
      _data(
        (await apiService.client().post<dynamic>(
          WebConstant.financeCategories,
          data: draft.toJson(),
        )).data,
      ),
    ),
  );

  @override
  Future<Either<ServerFailure, FinanceCategory>> updateCategory(
    String id,
    CategoryDraft draft, {
    required bool isActive,
  }) => _guard('updateCategory', () async {
    final Map<String, dynamic> body = draft.toJson();
    body.remove('kind');
    body.remove('parentId');
    body['isActive'] = isActive;
    return financeCategoryFromJson(
      _data(
        (await apiService.client().patch<dynamic>(
          WebConstant.financeCategory(id),
          data: body,
        )).data,
      ),
    );
  });

  @override
  Future<Either<ServerFailure, FinanceCategory>> moveCategory(
    String id,
    String? parentId,
  ) => _guard(
    'moveCategory',
    () async => financeCategoryFromJson(
      _data(
        (await apiService.client().patch<dynamic>(
          WebConstant.financeCategoryMove(id),
          data: <String, dynamic>{'newParentId': parentId},
        )).data,
      ),
    ),
  );

  @override
  Future<Either<ServerFailure, Unit>> deleteCategory(String id) =>
      _guard('deleteCategory', () async {
        await apiService.client().delete<dynamic>(
          WebConstant.financeCategory(id),
        );
        return unit;
      });

  @override
  Future<Either<ServerFailure, FinanceBreakdown>> breakdown(
    FinanceQuery query,
    FinanceKind kind, {
    String? rootCategoryId,
  }) => _guard(
    'breakdown',
    () async => financeBreakdownFromJson(
      _data(
        (await apiService.client().get<dynamic>(
          WebConstant.financeByCategory,
          queryParameters: <String, dynamic>{
            ...query.toQuery(),
            'kind': kind.apiValue,
            'rootCategoryId': ?rootCategoryId,
          },
        )).data,
      ),
    ),
  );

  @override
  Future<Either<ServerFailure, FinanceBudgetsPage>> budgets(
    FinanceQuery query, {
    int page = 1,
  }) => _guard('budgets', () async {
    final Map<String, dynamic> body = _body(
      (await apiService.client().get<dynamic>(
        WebConstant.financeBudgets,
        queryParameters: <String, dynamic>{
          ApiKeys.page: page,
          ApiKeys.limit: 20,
          ..._budgetListQuery(query),
        },
      )).data,
    );
    return FinanceBudgetsPage(
      items: _list(
        body['data'],
      ).map(financeBudgetFromJson).toList(growable: false),
      meta: PaginationMetaModel.fromJson(_map(body['meta'])),
    );
  });

  @override
  Future<Either<ServerFailure, FinanceBudget>> createBudget(
    BudgetDraft draft,
  ) => _guard(
    'createBudget',
    () async => financeBudgetFromJson(
      _data(
        (await apiService.client().post<dynamic>(
          WebConstant.financeBudgets,
          data: draft.toJson(),
        )).data,
      ),
    ),
  );

  @override
  Future<Either<ServerFailure, FinanceBudget>> updateBudget(
    String id,
    BudgetDraft draft,
  ) => _guard(
    'updateBudget',
    () async => financeBudgetFromJson(
      _data(
        (await apiService.client().patch<dynamic>(
          WebConstant.financeBudget(id),
          data: draft.toJson(forUpdate: true),
        )).data,
      ),
    ),
  );

  @override
  Future<Either<ServerFailure, Unit>> deleteBudget(String id) => _guard(
    'deleteBudget',
    () async {
      await apiService.client().delete<dynamic>(WebConstant.financeBudget(id));
      return unit;
    },
  );

  @override
  Future<Either<ServerFailure, List<FinanceRef>>> branches() =>
      _refs(WebConstant.branches, StorageKeys.financeBranches);
  @override
  Future<Either<ServerFailure, List<FinanceRef>>> suppliers() =>
      _refs(WebConstant.financeSuppliers, StorageKeys.financeSuppliers);
  @override
  Future<Either<ServerFailure, List<FinanceRef>>> paymentMethods() =>
      _refs(WebConstant.paymentMethods, StorageKeys.financePaymentMethods);

  Future<Either<ServerFailure, List<FinanceRef>>> _refs(
    String path,
    String cacheKey,
  ) async {
    if (!await networkInfo.isConnected) return _cachedRefs(cacheKey);
    final result = await _guard('refs', () async {
      // Payment methods stay an unpaged seeded catalogue. Branches and
      // suppliers now default to 20 rows, so the offline copy has to walk
      // pages or it will persist a truncated list.
      final List<Map<String, dynamic>> rows = path == WebConstant.paymentMethods
          ? _list(
              _rawData((await apiService.client().get<dynamic>(path)).data),
            )
          : await PaginatedFetch.all(client: apiService.client(), path: path);
      await LocalStorage.local?.setString(cacheKey, json.encode(rows));
      return rows.map(financeRefFromJson).toList(growable: false);
    }, checkConnection: false);
    return result.fold(
      (failure) =>
          failure is OfflineFailure ? _cachedRefs(cacheKey) : Left(failure),
      Right.new,
    );
  }

  Either<ServerFailure, List<FinanceCategory>> _cachedCategories(String key) {
    final List<Map<String, dynamic>> rows = _cachedList(key);
    return rows.isEmpty
        ? Left(OfflineFailure())
        : Right(rows.map(financeCategoryFromJson).toList(growable: false));
  }

  Either<ServerFailure, List<FinanceRef>> _cachedRefs(String key) {
    final List<Map<String, dynamic>> rows = _cachedList(key);
    return rows.isEmpty
        ? Left(OfflineFailure())
        : Right(rows.map(financeRefFromJson).toList(growable: false));
  }

  static List<Map<String, dynamic>> _cachedList(String key) {
    try {
      return _list(json.decode(LocalStorage.local?.getString(key) ?? '[]'));
    } catch (_) {
      return const <Map<String, dynamic>>[];
    }
  }

  static FinanceTransaction _pendingTransaction(TransactionDraft draft) =>
      FinanceTransaction(
        id: draft.clientUuid!,
        referenceNo: '',
        kind: draft.kind,
        amount: draft.amount,
        category: FinanceRef(id: draft.categoryId, name: ''),
        transactionDate: draft.transactionDate,
        paymentMethod: FinanceRef(id: draft.paymentMethodId, name: ''),
        source: 'MANUAL',
        isVoided: false,
        isEditable: false,
        isVoidable: false,
        notes: draft.notes,
        isPendingSync: true,
      );

  Future<Either<ServerFailure, T>> _guard<T>(
    String label,
    Future<T> Function() run, {
    bool checkConnection = true,
  }) async {
    try {
      if (checkConnection && !await networkInfo.isConnected) {
        return Left(OfflineFailure());
      }
      return Right(await run());
    } on PaginatedFetchCapException catch (error, stackTrace) {
      printDebug(
        message: 'finance repo $label page cap: $error',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.paginationListTooLarge.tr()));
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'finance repo $label: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'finance repo $label: $error',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  static Map<String, dynamic> _body(Object? raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
  static Object? _rawData(Object? raw) => _body(raw)['data'];
  static Map<String, dynamic> _data(Object? raw) => _map(_rawData(raw));
  static Map<String, dynamic> _map(Object? raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
  static List<Map<String, dynamic>> _list(Object? raw) => raw is List
      ? raw.whereType<Map<String, dynamic>>().toList(growable: false)
      : const <Map<String, dynamic>>[];

  /// `GET /finance/budgets/status` only accepts `asOf` and `branchId`. Sending
  /// the overview's `dateFrom`/`dateTo` would 400 under `forbidNonWhitelisted`.
  static Map<String, dynamic> _budgetStatusQuery(FinanceQuery query) =>
      <String, dynamic>{
        if (query.branchId != null) 'branchId': query.branchId,
        if (query.dateTo != null) 'asOf': financeDate(query.dateTo!),
      };

  /// `GET /finance/budgets` filters on `activeOn` / `branchId`, not a date range.
  static Map<String, dynamic> _budgetListQuery(FinanceQuery query) =>
      <String, dynamic>{
        if (query.branchId != null) 'branchId': query.branchId,
        if (query.dateTo != null)
          'activeOn': financeDate(query.dateTo!)
        else if (query.dateFrom != null)
          'activeOn': financeDate(query.dateFrom!),
      };
}

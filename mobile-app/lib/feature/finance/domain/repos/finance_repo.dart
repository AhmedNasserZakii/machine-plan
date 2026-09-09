import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';

class FinanceTransactionsPage {
  const FinanceTransactionsPage({required this.items, required this.meta});
  final List<FinanceTransaction> items;
  final PaginationMetaModel meta;
}

abstract class FinanceRepo {
  Future<Either<ServerFailure, FinanceSummary>> summary(FinanceQuery query);
  Future<Either<ServerFailure, BudgetStatusList>> budgetStatus(
    FinanceQuery query,
  );
  Future<Either<ServerFailure, FinanceTransactionsPage>> transactions(
    TransactionQuery query,
  );
  Future<Either<ServerFailure, FinanceTransaction>> transaction(String id);
  Future<Either<ServerFailure, FinanceTransaction>> createTransaction(
    TransactionDraft draft,
  );
  Future<Either<ServerFailure, FinanceTransaction>> updateTransaction(
    String id,
    TransactionDraft draft,
  );
  Future<Either<ServerFailure, FinanceTransaction>> voidTransaction(
    String id,
    String reason,
  );
  Future<int> flushPendingTransactions();
  Future<Either<ServerFailure, List<FinanceCategory>>> categories({
    FinanceKind? kind,
    bool includeInactive = false,
  });
  Future<Either<ServerFailure, FinanceCategory>> createCategory(
    CategoryDraft draft,
  );
  Future<Either<ServerFailure, FinanceCategory>> updateCategory(
    String id,
    CategoryDraft draft, {
    required bool isActive,
  });
  Future<Either<ServerFailure, FinanceCategory>> moveCategory(
    String id,
    String? parentId,
  );
  Future<Either<ServerFailure, Unit>> deleteCategory(String id);
  Future<Either<ServerFailure, FinanceBreakdown>> breakdown(
    FinanceQuery query,
    FinanceKind kind, {
    String? rootCategoryId,
  });
  Future<Either<ServerFailure, List<FinanceBudget>>> budgets(
    FinanceQuery query,
  );
  Future<Either<ServerFailure, FinanceBudget>> createBudget(BudgetDraft draft);
  Future<Either<ServerFailure, FinanceBudget>> updateBudget(
    String id,
    BudgetDraft draft,
  );
  Future<Either<ServerFailure, Unit>> deleteBudget(String id);
  Future<Either<ServerFailure, List<FinanceRef>>> branches();
  Future<Either<ServerFailure, List<FinanceRef>>> suppliers();
  Future<Either<ServerFailure, List<FinanceRef>>> paymentMethods();
}

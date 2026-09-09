import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/home/domain/entities/home_block.dart';
import 'package:machinery/feature/home/domain/entities/home_summaries.dart';

/// One method per dashboard tile, each independently fetchable so a refresh
/// (or a retry on a single failed tile) never has to touch the others.
///
/// Every method absorbs its own network/offline/error handling and always
/// resolves — never throws, never returns a bare failure — because a
/// dashboard tile has nothing useful to do with an unhandled exception except
/// show it, and [HomeBlock] already has a case for that.
abstract class HomeRepo {
  Future<HomeBlock<MachinesSummary>> machinesSummary();

  Future<HomeBlock<TransfersSummary>> transfersSummary();

  Future<HomeBlock<MerchantsSummary>> merchantsSummary();

  Future<HomeBlock<ViolationsSummary>> violationsSummary();

  Future<HomeBlock<MaintenanceSummary>> maintenanceSummary();

  Future<HomeBlock<FinanceSummary>> financeSummary();

  Future<HomeBlock<BudgetStatusList>> budgetsSummary();
}

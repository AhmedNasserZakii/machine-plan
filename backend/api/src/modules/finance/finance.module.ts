import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { MediaModule } from 'src/modules/media/media.module';
import { BudgetsController } from './budgets.controller';
import { Budget } from './entities/budget.entity';
import { FinanceCategory } from './entities/finance-category.entity';
import { FinanceCategoryTranslation } from './entities/finance-category-translation.entity';
import { FinanceTransaction } from './entities/finance-transaction.entity';
import { Supplier } from './entities/supplier.entity';
import { FinanceCategoriesController } from './finance-categories.controller';
import { FinanceTransactionsController } from './finance-transactions.controller';
import { BudgetsService } from './services/budgets.service';
import { FinanceCategoriesService } from './services/finance-categories.service';
import { FinancePostingService } from './services/finance-posting.service';
import { FinanceReportsService } from './services/finance-reports.service';
import { FinanceTransactionsService } from './services/finance-transactions.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './services/suppliers.service';

/**
 * `FinancePostingService` is what other feature modules get: the one thing they are allowed to do
 * to the ledger is post an auto transaction against their own record — not query it, not edit it,
 * and not delete from it.
 *
 * `FinanceTransactionsService` is exported for `SyncModule` alone, which is not a feature module
 * but a second door onto the same manual-entry endpoint: an accountant's offline queue has to
 * reach the identical create, with the identical checks, or the offline path would drift from
 * the online one.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceCategory,
      FinanceCategoryTranslation,
      FinanceTransaction,
      Supplier,
      Budget,
      PaymentMethod,
    ]),
    MediaModule,
  ],
  controllers: [
    FinanceCategoriesController,
    FinanceTransactionsController,
    BudgetsController,
    SuppliersController,
  ],
  providers: [
    FinanceCategoriesService,
    FinanceTransactionsService,
    FinanceReportsService,
    BudgetsService,
    SuppliersService,
    FinancePostingService,
  ],
  /**
   * `BudgetsService` is exported for the notification sweeps alone (`18`): the daily pass has to
   * answer "is this budget blown as of today" and must do it with the same computation the
   * finance screens use, or the alert and the screen would eventually disagree about the same
   * budget. It is read-only from there — the escalation level is the sweep's own write.
   */
  exports: [FinancePostingService, FinanceTransactionsService, BudgetsService],
})
export class FinanceModule {}

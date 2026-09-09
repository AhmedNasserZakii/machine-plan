import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceCategory } from 'src/modules/finance/entities/finance-category.entity';
import { FinanceCategoryTranslation } from 'src/modules/finance/entities/finance-category-translation.entity';
import { FinanceTransaction } from 'src/modules/finance/entities/finance-transaction.entity';
import { FinanceModule } from 'src/modules/finance/finance.module';
import { LookupsModule } from 'src/modules/lookups/lookups.module';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MachinesModule } from 'src/modules/machines/machines.module';
import { MediaModule } from 'src/modules/media/media.module';
import { Merchant } from 'src/modules/merchants/entities/merchant.entity';
import { MerchantsModule } from 'src/modules/merchants/merchants.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { Transfer } from 'src/modules/transfers/entities/transfer.entity';
import { TransfersModule } from 'src/modules/transfers/transfers.module';
import { SyncBatchService } from './sync-batch.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

/**
 * Sits at the very bottom of the dependency graph: it reads from and writes through the feature
 * modules and nothing imports it back. That is what lets the offline path reuse the online
 * services instead of restating their rules — there is one `create a transfer`, and
 * `POST /sync/batch` is a second door into it.
 *
 * The repositories are registered here rather than reached through the feature modules, which
 * export services and not data access on purpose. What the batch reads them for is narrow: has
 * this operation already been applied, and what does the server hold instead — questions about
 * rows, not operations the owning module has any business exposing.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceCategory,
      FinanceCategoryTranslation,
      FinanceTransaction,
      Machine,
      Merchant,
      Transfer,
    ]),
    LookupsModule,
    OrganizationModule,
    MachinesModule,
    MerchantsModule,
    TransfersModule,
    FinanceModule,
    MediaModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncBatchService],
})
export class SyncModule {}

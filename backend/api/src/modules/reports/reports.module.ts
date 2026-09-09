import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfRendererService } from 'src/common/export';
import { FinanceModule } from 'src/modules/finance/finance.module';
import { MediaModule } from 'src/modules/media/media.module';
import { ReportJob } from './entities/report-job.entity';
import { ReportsController } from './reports.controller';
import { FinanceReportsService } from './services/finance-reports.service';
import { MachineReportsService } from './services/machine-reports.service';
import { OperationsReportsService } from './services/operations-reports.service';
import { ReportExportService } from './services/report-export.service';
import { ReportJobsService } from './services/report-jobs.service';
import { ReportQueueService } from './services/report-queue.service';
import { ReportRunnerService } from './services/report-runner.service';

/**
 * Reports (`17`). Read-only, except for the one job row an export writes.
 *
 * The three query services take a `DataSource` and no repositories: every report is raw SQL
 * against tables that belong to other modules, and registering their entities here would suggest
 * this module may write to them. It may not.
 *
 * `FinanceModule` is imported for `BudgetsService` alone — the budget report has to agree with
 * the budget screens, and the only way to guarantee that is to call the same code. `MediaModule`
 * provides the object store the finished files land in, and the signed-URL endpoint that serves
 * them back.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReportJob]), FinanceModule, MediaModule],
  controllers: [ReportsController],
  providers: [
    MachineReportsService,
    OperationsReportsService,
    FinanceReportsService,
    ReportRunnerService,
    ReportExportService,
    ReportQueueService,
    ReportJobsService,
    PdfRendererService,
  ],
  exports: [ReportQueueService],
})
export class ReportsModule {}

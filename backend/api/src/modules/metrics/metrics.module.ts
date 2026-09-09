import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from 'src/common/interceptors/metrics.interceptor';
import { MediaModule } from 'src/modules/media/media.module';
import { ReportsModule } from 'src/modules/reports/reports.module';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { MetricsController } from './metrics.controller';

/**
 * `4.4`. `AuditQueueService` needs no import here — `AuditModule` is `@Global()` and now
 * exports it. `MediaModule`/`ReportsModule` are imported for `MediaOptimizeQueueService`/
 * `ReportQueueService`, which `MetricsController` reads queue depth from at scrape time.
 */
@Module({
  imports: [MediaModule, ReportsModule],
  controllers: [MetricsController],
  providers: [MetricsAuthGuard, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class MetricsModule {}

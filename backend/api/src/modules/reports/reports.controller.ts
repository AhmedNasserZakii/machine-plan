import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { CurrentUser, BranchScoped, Permissions, ReqLocale, Scope } from 'src/common/decorators';
import { ReportFormat, ReportKey } from 'src/common/enums/report.enum';
import { AppException } from 'src/common/errors';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  CustodyReportQueryDto,
  IdleReportQueryDto,
  ProfitLossQueryDto,
  ReportQueryDto,
  WarrantyReportQueryDto,
} from './dto/report-query.dto';
import {
  ReportCatalogueEntryResponse,
  ReportJobAcceptedResponse,
  ReportJobResponse,
  ReportResponse,
} from './dto/responses/report.response';
import { REPORT_CATALOGUE, REPORT_PATHS, reportTitle } from './report-catalogue';
import { ReportJob } from './entities/report-job.entity';
import { ReportParams, ReportRunnerService } from './services/report-runner.service';
import { ReportJobsService } from './services/report-jobs.service';
import { ReportResult } from './report.types';

/**
 * All seventeen reports of `17`, plus the job endpoints their file exports poll.
 *
 * Every handler is three lines because they differ only in the report key and the guard pair:
 * the permission the endpoint needs, and the `*.read.all` that decides whether the caller sees
 * one branch or all of them. Both are declarative, so a report cannot be added without saying
 * out loud who may run it.
 */
@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly runner: ReportRunnerService,
    private readonly jobs: ReportJobsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The report catalogue, flagged with what this caller may run',
    description: 'Fixed catalogue defined in code. Not paginated.',
  })
  @ApiResponse({ status: 200, type: [ReportCatalogueEntryResponse] })
  catalogue(
    @CurrentUser() user: AuthUser,
    @ReqLocale() locale: Locale,
  ): ReportCatalogueEntryResponse[] {
    return REPORT_CATALOGUE.map((definition) => ({
      key: definition.key,
      title: definition.titles[locale],
      permission: definition.permission,
      path: REPORT_PATHS[definition.key],
      allowed: user.permissions.includes(definition.permission),
    }));
  }

  // ── machines ───────────────────────────────────────────────────────────────

  @Get('machines/inventory')
  @Permissions(Perm.REPORTS_MACHINES)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Every machine, where it is and who holds it' })
  @ApiResponse({ status: 200, type: ReportResponse })
  inventory(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.MACHINE_INVENTORY, query, scope, locale, user, res);
  }

  @Get('machines/custody')
  @Permissions(Perm.REPORTS_MACHINES)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Who has what, grouped by holder' })
  @ApiResponse({ status: 200, type: ReportResponse })
  custody(
    @Query() query: CustodyReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.MACHINE_CUSTODY, query, scope, locale, user, res);
  }

  @Get('machines/idle')
  @Permissions(Perm.REPORTS_MACHINES)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Machines with no hand-off in N days' })
  @ApiResponse({ status: 200, type: ReportResponse })
  idle(
    @Query() query: IdleReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.MACHINE_IDLE, query, scope, locale, user, res);
  }

  @Get('machines/costs')
  @Permissions(Perm.REPORTS_MACHINES)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Purchase against cumulative repair, along the replacement chain' })
  @ApiResponse({ status: 200, type: ReportResponse })
  costs(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.MACHINE_COSTS, query, scope, locale, user, res);
  }

  @Get('machines/warranty')
  @Permissions(Perm.REPORTS_MACHINES)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Warranties lapsing within N days' })
  @ApiResponse({ status: 200, type: ReportResponse })
  warranty(
    @Query() query: WarrantyReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.WARRANTY_EXPIRY, query, scope, locale, user, res);
  }

  @Get('machines/:id/lifecycle')
  @Permissions(Perm.REPORTS_MACHINES)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'One machine’s whole history as a single timeline' })
  @ApiResponse({ status: 200, type: ReportResponse })
  @ApiResponse({
    status: 404,
    description: 'MACHINE_NOT_FOUND — also for another branch’s machine',
  })
  lifecycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.MACHINE_LIFECYCLE, query, scope, locale, user, res, {
      machineId: id,
    });
  }

  // ── transfers ──────────────────────────────────────────────────────────────

  @Get('transfers')
  @Permissions(Perm.REPORTS_TRANSFERS)
  @BranchScoped(Perm.TRANSFERS_READ_ALL)
  @ApiOperation({ summary: 'Every hand-off in the period' })
  @ApiResponse({ status: 200, type: ReportResponse })
  transfers(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.TRANSFERS_LOG, query, scope, locale, user, res);
  }

  @Get('transfers/pending')
  @Permissions(Perm.REPORTS_TRANSFERS)
  @BranchScoped(Perm.TRANSFERS_READ_ALL)
  @ApiOperation({ summary: 'Hand-offs still waiting for a signature' })
  @ApiResponse({ status: 200, type: ReportResponse })
  pendingTransfers(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.TRANSFERS_PENDING, query, scope, locale, user, res);
  }

  // ── people, merchants, maintenance ─────────────────────────────────────────

  @Get('representatives')
  @Permissions(Perm.REPORTS_VIOLATIONS)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'Per-representative custody, placements, violations and score' })
  @ApiResponse({ status: 200, type: ReportResponse })
  representatives(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.REPRESENTATIVE_PERFORMANCE, query, scope, locale, user, res);
  }

  @Get('violations')
  @Permissions(Perm.REPORTS_VIOLATIONS)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'The violations register for the period' })
  @ApiResponse({ status: 200, type: ReportResponse })
  violations(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.VIOLATIONS_REGISTER, query, scope, locale, user, res);
  }

  @Get('merchants')
  @Permissions(Perm.MERCHANTS_READ)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Merchants with machine counts and subscription standing' })
  @ApiResponse({ status: 200, type: ReportResponse })
  merchants(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.MERCHANT_PORTFOLIO, query, scope, locale, user, res);
  }

  @Get('maintenance')
  @Permissions(Perm.MAINTENANCE_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Maintenance orders, costs, locations and outcomes' })
  @ApiResponse({ status: 200, type: ReportResponse })
  maintenance(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.MAINTENANCE_LOG, query, scope, locale, user, res);
  }

  // ── finance ────────────────────────────────────────────────────────────────

  @Get('finance/expenses')
  @Permissions(Perm.REPORTS_FINANCE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'The nested expense breakdown, direct and rolled up' })
  @ApiResponse({ status: 200, type: ReportResponse })
  expenses(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.EXPENSES_BY_CATEGORY, query, scope, locale, user, res);
  }

  @Get('finance/income')
  @Permissions(Perm.REPORTS_FINANCE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'The same breakdown for income' })
  @ApiResponse({ status: 200, type: ReportResponse })
  income(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.INCOME_BY_CATEGORY, query, scope, locale, user, res);
  }

  @Get('finance/pnl')
  @Permissions(Perm.REPORTS_FINANCE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Income less expense, by period and by branch' })
  @ApiResponse({ status: 200, type: ReportResponse })
  profitLoss(
    @Query() query: ProfitLossQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.PROFIT_LOSS, query, scope, locale, user, res);
  }

  @Get('finance/budgets')
  @Permissions(Perm.REPORTS_FINANCE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Budget against actual, with the pace behind it' })
  @ApiResponse({ status: 200, type: ReportResponse })
  budgets(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.BUDGET_PERFORMANCE, query, scope, locale, user, res);
  }

  @Get('branches/comparison')
  @Permissions(Perm.REPORTS_FINANCE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Branches side by side on the numbers that separate them' })
  @ApiResponse({ status: 200, type: ReportResponse })
  branchComparison(
    @Query() query: ReportQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    return this.deliver(ReportKey.BRANCH_COMPARISON, query, scope, locale, user, res);
  }

  // ── export jobs ────────────────────────────────────────────────────────────

  @Get('jobs/:id')
  @Permissions(Perm.REPORTS_EXPORT)
  @ApiOperation({ summary: 'Poll an export job; READY carries a signed download URL' })
  @ApiResponse({ status: 200, type: ReportJobResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND — also for another caller’s job' })
  async job(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ReportJobResponse> {
    return this.toJobResponse(await this.jobs.findOne(id, user.id));
  }

  private async toJobResponse(job: ReportJob): Promise<ReportJobResponse> {
    return {
      id: job.id,
      reportKey: job.reportKey,
      format: job.format,
      status: job.status,
      filters: job.filters,
      rowCount: job.rowCount,
      filename: job.filename,
      sizeBytes: job.sizeBytes,
      downloadUrl: await this.jobs.downloadUrlFor(job),
      errorCode: job.errorCode,
      expiresAt: job.expiresAt.toISOString(),
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * Runs the report and answers in whichever shape the caller asked for: the page itself, or a
   * job id to poll for a file.
   *
   * Paging is applied here rather than in the runner because the cached result is the *whole*
   * report — an export of the same request has to contain every row, and a caller turning to
   * page four must not re-run seventeen aggregates to see it.
   */
  private async deliver(
    key: ReportKey,
    query: ReportQueryDto,
    scope: BranchScope,
    locale: Locale,
    user: AuthUser,
    res: Response,
    params: ReportParams = {},
  ): Promise<ReportResponse | ReportJobAcceptedResponse> {
    const context = this.runner.buildContext(query, scope, locale, user.id);
    const format = query.format ?? ReportFormat.JSON;

    if (format !== ReportFormat.JSON) {
      // Checked here rather than as a route guard because the same endpoint serves both shapes:
      // `reports.export` gates the file, not the report. Without it a caller could start a job
      // and then be refused by `GET /reports/jobs/:id`, which holds the same permission.
      if (!user.permissions.includes(Perm.REPORTS_EXPORT)) {
        throw AppException.forbidden(ErrorCode.INSUFFICIENT_PERMISSIONS, {
          required: Perm.REPORTS_EXPORT,
        });
      }

      // Run first so a report the caller cannot see, or a filter that cannot be honoured, fails
      // as a 4xx here instead of as a job that is only found to be broken on the third poll.
      await this.runner.run(key, context, query, params);

      const job = await this.jobs.create(key, format, context, query, params);
      res.status(202);

      return {
        jobId: job.id,
        status: job.status,
        pollUrl: `/api/v1/reports/jobs/${job.id}`,
      };
    }

    const result = await this.runner.run(key, context, query, params);

    return toReportResponse(result, locale, query.skip, query.take);
  }
}

function toReportResponse(
  result: ReportResult,
  locale: Locale,
  skip: number,
  take: number,
): ReportResponse {
  return {
    key: result.key,
    title: reportTitle(result.key, locale),
    generatedAt: result.generatedAt,
    filters: result.filters,
    columns: result.columns,
    rows: result.rows.slice(skip, skip + take),
    totals: result.totals,
    rowCount: result.rows.length,
    truncated: result.truncated ?? false,
    ...(result.extra ? { extra: result.extra } : {}),
  };
}

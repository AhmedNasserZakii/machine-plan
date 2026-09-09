import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from 'src/common/constants/locales';
import { CacheKeys, CacheService } from 'src/common/cache';
import { ErrorCode } from 'src/common/constants/error-codes';
import { ReportKey } from 'src/common/enums/report.enum';
import { AppException } from 'src/common/errors';
import { BranchScope } from 'src/common/types/request.types';
import { ReportsConfig } from 'src/config/reports.config';
import { ReportQueryDto } from '../dto/report-query.dto';
import { hashFilters, resolveBranchFilter, resolvePeriod } from '../report-filters';
import { ReportContext, ReportResult, ReportRow, ReportRunQuery } from '../report.types';
import { FinanceReportsService } from './finance-reports.service';
import { MachineReportsService } from './machine-reports.service';
import { OperationsReportsService } from './operations-reports.service';

/** Everything a report run needs beyond the shared query: the machine id, mostly. */
export interface ReportParams {
  machineId?: string;
}

/**
 * One door into all seventeen reports (`17`).
 *
 * Two things live here rather than in each report. **Caching**, because rule 7 is one policy and
 * seventeen copies of it would drift; and **sorting and paging**, because they are applied to the
 * finished result rather than pushed into SQL — the row cap has already bounded it, and a
 * `sortBy` taken from a query string has no business being interpolated into a statement.
 */
@Injectable()
export class ReportRunnerService {
  private readonly config: ReportsConfig;

  constructor(
    private readonly machines: MachineReportsService,
    private readonly operations: OperationsReportsService,
    private readonly finance: FinanceReportsService,
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<ReportsConfig>('reports');
  }

  /** Resolves the filters a report actually runs with, which is also what it reports back. */
  buildContext(
    query: ReportQueryDto,
    scope: BranchScope,
    locale: Locale,
    userId: string,
  ): ReportContext {
    const period = resolvePeriod(query.dateFrom, query.dateTo, new Date());

    return {
      scope,
      userId,
      locale,
      branchId: resolveBranchFilter(query.branchId, scope),
      from: period.from,
      to: period.to,
      maxRows: this.config.maxRows,
    };
  }

  /**
   * The whole report, cached and sorted — never paged.
   *
   * Paging is the caller's business precisely because the cache holds the full answer: turning to
   * page four of a report is a slice, not a second query, and an export of the same report is the
   * identical rows without one.
   */
  async run(
    key: ReportKey,
    context: ReportContext,
    query: ReportRunQuery,
    params: ReportParams = {},
  ): Promise<ReportResult> {
    const identity = {
      key,
      branchId: context.branchId,
      from: context.from,
      to: context.to,
      locale: context.locale,
      groupBy: query.groupBy ?? null,
      days: query.days ?? null,
      granularity: query.granularity ?? null,
      machineId: params.machineId ?? null,
    };

    // Keyed by principal as well as filters (`17`, rule 7): two supervisors asking for the same
    // report are asking two different questions, and one must not be served the other's answer.
    const cacheKey = CacheKeys.reportForUser(key, hashFilters(identity), context.userId);

    const result = await this.cache.remember(cacheKey, this.config.cacheTtlSeconds, () =>
      this.execute(key, context, query, params),
    );

    return this.sorted(result, query);
  }

  private execute(
    key: ReportKey,
    context: ReportContext,
    query: ReportRunQuery,
    params: ReportParams,
  ): Promise<ReportResult> {
    switch (key) {
      case ReportKey.MACHINE_INVENTORY:
        return this.machines.inventory(context);
      case ReportKey.MACHINE_CUSTODY:
        return this.machines.custody(context, query);
      case ReportKey.MACHINE_IDLE:
        return this.machines.idle(context, query);
      case ReportKey.MACHINE_LIFECYCLE:
        return this.machines.lifecycle(context, requireMachineId(params));
      case ReportKey.MACHINE_COSTS:
        return this.machines.costs(context);
      case ReportKey.WARRANTY_EXPIRY:
        return this.machines.warranty(context, query);
      case ReportKey.TRANSFERS_LOG:
        return this.operations.transfersLog(context);
      case ReportKey.TRANSFERS_PENDING:
        return this.operations.transfersPending(context);
      case ReportKey.REPRESENTATIVE_PERFORMANCE:
        return this.operations.representativePerformance(context);
      case ReportKey.VIOLATIONS_REGISTER:
        return this.operations.violationsRegister(context);
      case ReportKey.MERCHANT_PORTFOLIO:
        return this.operations.merchantPortfolio(context);
      case ReportKey.MAINTENANCE_LOG:
        return this.operations.maintenanceLog(context);
      case ReportKey.EXPENSES_BY_CATEGORY:
        return this.finance.expensesByCategory(context);
      case ReportKey.INCOME_BY_CATEGORY:
        return this.finance.incomeByCategory(context);
      case ReportKey.PROFIT_LOSS:
        return this.finance.profitLoss(context, query);
      case ReportKey.BUDGET_PERFORMANCE:
        return this.finance.budgetPerformance(context);
      case ReportKey.BRANCH_COMPARISON:
        return this.finance.branchComparison(context);
    }
  }

  /**
   * Reorders the materialised rows on one of the report's own column keys.
   *
   * An unknown key is a 422 rather than a silent fallback to the default order: a caller sorting
   * on `cost` and quietly getting alphabetical order would read the wrong row as the worst one.
   */
  private sorted(result: ReportResult, query: ReportRunQuery): ReportResult {
    if (!query.sortBy) return result;

    const column = result.columns.find((entry) => entry.key === query.sortBy);
    if (!column) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          {
            field: 'sortBy',
            constraint: `must be one of: ${result.columns.map((entry) => entry.key).join(', ')}`,
          },
        ],
      });
    }

    const direction = query.sortDir === 'asc' ? 1 : -1;
    const rows = [...result.rows].sort((left, right) =>
      compare(left[column.key], right[column.key], direction),
    );

    return { ...result, rows };
  }
}

/**
 * Nulls sort last whichever way the column is sorted — an empty cell is not the smallest value,
 * it is no value, and a descending sort that opens with forty blanks is useless.
 */
function compare(left: ReportRow[string], right: ReportRow[string], direction: number): number {
  const leftEmpty = left === null || left === undefined;
  const rightEmpty = right === null || right === undefined;

  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty ? 0 : leftEmpty ? 1 : -1;

  if (typeof left === 'number' && typeof right === 'number') return direction * (left - right);

  return direction * String(left).localeCompare(String(right), 'ar');
}

function requireMachineId(params: ReportParams): string {
  if (!params.machineId) {
    throw new AppException(ErrorCode.VALIDATION_FAILED, {
      details: [{ field: 'machineId', constraint: 'required' }],
    });
  }

  return params.machineId;
}

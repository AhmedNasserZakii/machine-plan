import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Locale } from 'src/common/constants/locales';
import {
  AuditFinanceRead,
  BranchScoped,
  CurrentUser,
  Idempotent,
  Permissions,
  ReqLocale,
  Scope,
} from 'src/common/decorators';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  CreateFinanceTransactionDto,
  ExportFinanceTransactionsDto,
  FinanceByCategoryQueryDto,
  FinanceSummaryQueryDto,
  QueryFinanceTransactionsDto,
  UpdateFinanceTransactionDto,
  VoidFinanceTransactionDto,
} from './dto/finance-transaction.dto';
import {
  FinanceByCategoryResponse,
  FinanceSummaryResponse,
} from './dto/responses/finance-report.response';
import { FinanceTransactionResponse } from './dto/responses/finance-transaction.response';
import { toFinanceTransactionResponse } from './mappers/finance-transaction.mapper';
import { FinanceReportsService } from './services/finance-reports.service';
import { FinanceTransactionsService } from './services/finance-transactions.service';

@ApiTags('finance')
@ApiBearerAuth('access-token')
@Controller({ path: 'finance', version: '1' })
export class FinanceTransactionsController {
  constructor(
    private readonly transactions: FinanceTransactionsService,
    private readonly reports: FinanceReportsService,
  ) {}

  @Get('transactions')
  @AuditFinanceRead()
  @Permissions(Perm.FINANCE_READ)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: "List transactions; a branch sees its own plus the company's" })
  @ApiResponse({ status: 200, type: [FinanceTransactionResponse] })
  async findAll(
    @Query() query: QueryFinanceTransactionsDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<FinanceTransactionResponse>> {
    const { page, view } = await this.transactions.findAll(query, scope, locale);
    return page.map((transaction) => toFinanceTransactionResponse(transaction, view));
  }

  @Get('summary')
  @AuditFinanceRead()
  @Permissions(Perm.FINANCE_READ)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'The dashboard number block' })
  @ApiResponse({ status: 200, type: FinanceSummaryResponse })
  async summary(
    @Query() query: FinanceSummaryQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceSummaryResponse> {
    return this.reports.summary(query, scope, locale);
  }

  @Get('by-category')
  @AuditFinanceRead()
  @Permissions(Perm.FINANCE_READ)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Where every category\u2019s money went, rolled up' })
  @ApiResponse({ status: 200, type: FinanceByCategoryResponse })
  async byCategory(
    @Query() query: FinanceByCategoryQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceByCategoryResponse> {
    return this.reports.byCategory(query, scope, locale);
  }

  /**
   * Streamed straight back rather than queued: the row cap in the service keeps this inside a
   * request, and a download the accountant already has beats a job id he has to poll.
   */
  @Get('export')
  @AuditFinanceRead()
  @Permissions(Perm.REPORTS_EXPORT)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Download the current selection as CSV or xlsx' })
  @ApiResponse({ status: 200, description: 'text/csv or an xlsx workbook' })
  async export(
    @Query() query: ExportFinanceTransactionsDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.transactions.export(query, scope, locale);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.end(file.body);
  }

  @Get('transactions/:id')
  @AuditFinanceRead()
  @Permissions(Perm.FINANCE_READ)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'One transaction' })
  @ApiResponse({ status: 200, type: FinanceTransactionResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceTransactionResponse> {
    const { transaction, view } = await this.transactions.findById(id, scope, locale);
    return toFinanceTransactionResponse(transaction, view);
  }

  @Post('transactions')
  @Idempotent()
  @Permissions(Perm.FINANCE_CREATE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Book an expense or an income' })
  @ApiResponse({ status: 201, type: FinanceTransactionResponse })
  @ApiResponse({ status: 422, description: 'CATEGORY_KIND_MISMATCH, FUTURE_DATE_NOT_ALLOWED' })
  async create(
    @Body() dto: CreateFinanceTransactionDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceTransactionResponse> {
    const { transaction, view } = await this.transactions.create(dto, scope, actor, locale);
    return toFinanceTransactionResponse(transaction, view);
  }

  @Patch('transactions/:id')
  @Permissions(Perm.FINANCE_UPDATE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Correct a manual transaction inside its edit window' })
  @ApiResponse({ status: 200, type: FinanceTransactionResponse })
  @ApiResponse({ status: 422, description: 'AUTO_TRANSACTION_IMMUTABLE, EDIT_WINDOW_EXPIRED' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceTransactionDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceTransactionResponse> {
    const { transaction, view } = await this.transactions.update(id, dto, scope, actor, locale);
    return toFinanceTransactionResponse(transaction, view);
  }

  @Post('transactions/:id/void')
  @HttpCode(200)
  @Permissions(Perm.FINANCE_VOID)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Take a row out of the totals without erasing it' })
  @ApiResponse({ status: 200, type: FinanceTransactionResponse })
  @ApiResponse({ status: 409, description: 'TRANSACTION_ALREADY_VOIDED' })
  async void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidFinanceTransactionDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceTransactionResponse> {
    const { transaction, view } = await this.transactions.voidTransaction(
      id,
      dto,
      scope,
      actor,
      locale,
    );

    return toFinanceTransactionResponse(transaction, view);
  }
}

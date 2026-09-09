import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import {
  AuditFinanceRead,
  BranchScoped,
  CurrentUser,
  Permissions,
  ReqLocale,
  Scope,
} from 'src/common/decorators';
import { BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  BudgetStatusQueryDto,
  CreateBudgetDto,
  QueryBudgetsDto,
  UpdateBudgetDto,
} from './dto/budget.dto';
import { BudgetResponse, BudgetStatusListResponse } from './dto/responses/budget.response';
import { toBudgetResponse, toBudgetStatusListResponse } from './mappers/budget.mapper';
import { BudgetsService } from './services/budgets.service';

@ApiTags('finance')
@ApiBearerAuth('access-token')
@Controller({ path: 'finance/budgets', version: '1' })
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @AuditFinanceRead()
  @Permissions(Perm.FINANCE_READ)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'List budgets' })
  @ApiResponse({ status: 200, type: [BudgetResponse] })
  async findAll(
    @Query() query: QueryBudgetsDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<BudgetResponse[]> {
    const { budgets, view } = await this.budgets.findAll(query, scope, locale);
    return budgets.map((budget) => toBudgetResponse(budget, view));
  }

  /** Declared before `:id` so the literal wins the route match. */
  @Get('status')
  @AuditFinanceRead()
  @Permissions(Perm.FINANCE_READ)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Every budget with its spend, status and pace' })
  @ApiResponse({ status: 200, type: BudgetStatusListResponse })
  async status(
    @Query() query: BudgetStatusQueryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<BudgetStatusListResponse> {
    const { asOf, computed, view } = await this.budgets.status(query, scope, locale);
    return toBudgetStatusListResponse(asOf, computed, view);
  }

  @Get(':id')
  @AuditFinanceRead()
  @Permissions(Perm.FINANCE_READ)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'One budget' })
  @ApiResponse({ status: 200, type: BudgetResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<BudgetResponse> {
    const { budget, view } = await this.budgets.findById(id, scope, locale);
    return toBudgetResponse(budget, view);
  }

  @Post()
  @Permissions(Perm.FINANCE_BUDGETS_MANAGE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Set a spending limit on an expense category' })
  @ApiResponse({ status: 201, type: BudgetResponse })
  @ApiResponse({ status: 409, description: 'OVERLAPPING_BUDGET' })
  @ApiResponse({ status: 422, description: 'BUDGET_ON_INCOME_CATEGORY' })
  async create(
    @Body() dto: CreateBudgetDto,
    @Scope() scope: BranchScope,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<BudgetResponse> {
    const { budget, view } = await this.budgets.create(dto, scope, actorId, locale);
    return toBudgetResponse(budget, view);
  }

  @Patch(':id')
  @Permissions(Perm.FINANCE_BUDGETS_MANAGE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Revise the limit, threshold or scope of a budget' })
  @ApiResponse({ status: 200, type: BudgetResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
    @Scope() scope: BranchScope,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<BudgetResponse> {
    const { budget, view } = await this.budgets.update(id, dto, scope, actorId, locale);
    return toBudgetResponse(budget, view);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions(Perm.FINANCE_BUDGETS_MANAGE)
  @BranchScoped(Perm.FINANCE_READ_ALL)
  @ApiOperation({ summary: 'Drop a budget; the transactions under it are untouched' })
  @ApiResponse({ status: 204, description: 'Removed' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    await this.budgets.remove(id, scope, actorId);
  }
}

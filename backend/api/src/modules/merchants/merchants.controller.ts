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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  BranchScoped,
  CurrentUser,
  Idempotent,
  Permissions,
  ReqLocale,
  Scope,
} from 'src/common/decorators';
import { CursorResult, PaginatedResult } from 'src/common/dto/paginated-result';
import { Locale } from 'src/common/constants/locales';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { MachineListItemResponse } from 'src/modules/machines/dto/responses/machine.response';
import { toMachineListItemResponse } from 'src/modules/machines/mappers/machine.mapper';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  CheckMerchantDto,
  CreateMerchantDto,
  CreateSubscriptionDto,
  MerchantTimelineQueryDto,
  QueryMerchantMachinesDto,
  QueryMerchantSubscriptionsDto,
  QueryMerchantsDto,
  QueryPickableMerchantsDto,
  UpdateMerchantDto,
} from './dto/merchant.dto';
import {
  MerchantDuplicateCheckResponse,
  MerchantListItemResponse,
  MerchantResponse,
  MerchantTimelineEntryResponse,
  SubscriptionResponse,
} from './dto/responses/merchant.response';
import {
  toMerchantListItemResponse,
  toMerchantResponse,
  toSubscriptionResponse,
} from './mappers/merchant.mapper';
import { MerchantsService } from './merchants.service';

@ApiTags('merchants')
@ApiBearerAuth('access-token')
@Controller({ path: 'merchants', version: '1' })
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get()
  @Permissions(Perm.MERCHANTS_READ)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({
    summary: 'List merchants; a representative sees only the shops he registered',
  })
  @ApiResponse({ status: 200, type: [MerchantListItemResponse] })
  async findAll(
    @Query() query: QueryMerchantsDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<PaginatedResult<MerchantListItemResponse>> {
    const page = await this.merchants.findAll(query, scope, actor);

    return page.map((row) => toMerchantListItemResponse(row.merchant, row.machinesCount));
  }

  /**
   * Declared before `:id` so the literal path is not parsed as a merchant id — Nest matches in
   * declaration order and `ParseUUIDPipe` would reject it first.
   */
  @Get('pickable')
  @Permissions(Perm.MERCHANTS_READ)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Merchants this caller may hand a machine to, for the transfer wizard' })
  @ApiResponse({ status: 200, type: [MerchantListItemResponse] })
  async pickable(
    @Query() query: QueryPickableMerchantsDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<PaginatedResult<MerchantListItemResponse>> {
    const page = await this.merchants.pickable(query, scope, actor);

    // The count is not worth a second query here: this feeds a picker, not a dashboard.
    return page.map((merchant) => toMerchantListItemResponse(merchant, 0));
  }

  // A POST because the phone travels in a body rather than a query string, but it creates
  // nothing — so 200, not Nest's default 201.
  @Post('check')
  @HttpCode(200)
  @Permissions(Perm.MERCHANTS_CREATE)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({
    summary: 'Pre-flight for the registration form; a duplicate phone warns but never blocks',
  })
  @ApiResponse({ status: 200, type: MerchantDuplicateCheckResponse })
  async check(
    @Body() dto: CheckMerchantDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<MerchantDuplicateCheckResponse> {
    const result = await this.merchants.checkDuplicates(dto, scope, actor);

    return {
      warnings: result.warnings,
      existing: result.existing.map((row) =>
        toMerchantListItemResponse(row.merchant, row.machinesCount),
      ),
    };
  }

  @Get(':id')
  @Permissions(Perm.MERCHANTS_READ)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'One merchant, with his live plan and what he has paid' })
  @ApiResponse({ status: 200, type: MerchantResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<MerchantResponse> {
    const row = await this.merchants.findById(id, scope, actor);
    return toMerchantResponse(row.merchant, row.machinesCount);
  }

  @Get(':id/machines')
  @Permissions(Perm.MERCHANTS_READ)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'What this merchant is holding right now' })
  @ApiResponse({ status: 200, type: [MachineListItemResponse] })
  async machines(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryMerchantMachinesDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<MachineListItemResponse>> {
    const page = await this.merchants.machinesOf(id, query, scope, actor);
    return page.map((machine) => toMachineListItemResponse(machine, locale));
  }

  @Get(':id/timeline')
  @Permissions(Perm.MERCHANTS_READ)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Hand-offs, plans and collections for this shop, newest first' })
  @ApiResponse({ status: 200, type: [MerchantTimelineEntryResponse] })
  async timeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MerchantTimelineQueryDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<CursorResult<MerchantTimelineEntryResponse>> {
    const page = await this.merchants.timeline(id, query, scope, actor);

    return page.map((entry) => ({
      kind: entry.kind,
      occurredAt: entry.occurredAt.toISOString(),
      refId: entry.refId,
      referenceNo: entry.referenceNo,
      machineSerial: entry.machineSerial,
      amount: entry.amount,
      code: entry.code,
    }));
  }

  @Get(':id/subscriptions')
  @Permissions(Perm.MERCHANTS_READ)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Every plan this merchant has had, live or ended' })
  @ApiResponse({ status: 200, type: [SubscriptionResponse] })
  async subscriptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryMerchantSubscriptionsDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<PaginatedResult<SubscriptionResponse>> {
    const page = await this.merchants.subscriptionsOf(id, query, scope, actor);
    return page.map((subscription) => toSubscriptionResponse(subscription));
  }

  @Post()
  @Idempotent()
  @Permissions(Perm.MERCHANTS_CREATE)
  @ApiOperation({ summary: 'Register a merchant; branch and registrar come from the caller' })
  @ApiResponse({ status: 201, type: MerchantResponse })
  @ApiResponse({ status: 409, description: 'DUPLICATE_NATIONAL_ID' })
  async create(
    @Body() dto: CreateMerchantDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<MerchantResponse> {
    const row = await this.merchants.create(dto, actor);
    return toMerchantResponse(row.merchant, row.machinesCount);
  }

  @Post(':id/subscriptions')
  @Idempotent()
  @Permissions(Perm.MERCHANTS_UPDATE)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Start a plan, merchant-wide or for one machine' })
  @ApiResponse({ status: 201, type: SubscriptionResponse })
  async createSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSubscriptionDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<SubscriptionResponse> {
    return toSubscriptionResponse(await this.merchants.createSubscription(id, dto, scope, actor));
  }

  @Patch(':id')
  @Permissions(Perm.MERCHANTS_UPDATE)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Correct the merchant record; branch and registrar are immutable' })
  @ApiResponse({ status: 200, type: MerchantResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<MerchantResponse> {
    const row = await this.merchants.update(id, dto, scope, actor);
    return toMerchantResponse(row.merchant, row.machinesCount);
  }

  @Patch(':id/deactivate')
  @Permissions(Perm.MERCHANTS_DELETE)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Close the merchant out; refused while he still holds machines' })
  @ApiResponse({ status: 200, type: MerchantResponse })
  @ApiResponse({ status: 409, description: 'MERCHANT_HAS_MACHINES, with the serials' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<MerchantResponse> {
    const row = await this.merchants.deactivate(id, scope, actor);
    return toMerchantResponse(row.merchant, row.machinesCount);
  }
}

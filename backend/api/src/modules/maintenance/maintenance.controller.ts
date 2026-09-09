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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { BranchScoped, Idempotent, Permissions, ReqLocale, Scope } from 'src/common/decorators';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { BranchScope, RequestContext } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  CancelMaintenanceOrderDto,
  CloseMaintenanceOrderDto,
  CreateMaintenanceOrderDto,
  QueryMaintenanceOrdersDto,
  ReceiveMaintenanceOrderDto,
  SendMaintenanceOrderDto,
  UpdateMaintenanceOrderDto,
} from './dto/maintenance.dto';
import {
  MaintenanceOrderListItemResponse,
  MaintenanceOrderResponse,
} from './dto/responses/maintenance.response';
import {
  toMaintenanceListItemResponse,
  toMaintenanceOrderResponse,
} from './mappers/maintenance.mapper';
import { MaintenanceActor, MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@ApiBearerAuth('access-token')
@Controller({ path: 'maintenance-orders', version: '1' })
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  /**
   * Scoped off `machines.read.all` rather than a `maintenance.read.all`, which is not one of the
   * seeded permissions: a repair is an event on a machine, so whoever may read the whole fleet may
   * read the whole fleet's repair history. Everybody else is held to their own branch.
   */
  @Get()
  @Permissions(Perm.MAINTENANCE_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'List maintenance orders; branch-scoped unless maintenance.read.all' })
  @ApiResponse({ status: 200, type: [MaintenanceOrderListItemResponse] })
  async findAll(
    @Query() query: QueryMaintenanceOrdersDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<MaintenanceOrderListItemResponse>> {
    const page = await this.maintenance.findAll(query, scope, locale);
    return page.map((order) => toMaintenanceListItemResponse(order, locale));
  }

  @Get(':id')
  @Permissions(Perm.MAINTENANCE_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'One order with the money artefacts its close produced' })
  @ApiResponse({ status: 200, type: MaintenanceOrderResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceOrderResponse> {
    return toMaintenanceOrderResponse(await this.maintenance.findById(id, scope, locale), locale);
  }

  @Post()
  @Idempotent()
  @Permissions(Perm.MAINTENANCE_CREATE)
  @ApiOperation({ summary: 'Open an order for a faulty machine' })
  @ApiResponse({ status: 201, type: MaintenanceOrderResponse })
  @ApiResponse({ status: 409, description: 'MACHINE_ALREADY_IN_MAINTENANCE' })
  @ApiResponse({ status: 422, description: 'INVALID_MACHINE_STATUS / MACHINE_RETIRED' })
  async create(
    @Body() dto: CreateMaintenanceOrderDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceOrderResponse> {
    const order = await this.maintenance.create(dto, actorOf(req), locale);
    return toMaintenanceOrderResponse(order, locale);
  }

  @Patch(':id')
  @Permissions(Perm.MAINTENANCE_UPDATE)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Correct the fault text, the destination or the cost' })
  @ApiResponse({ status: 200, type: MaintenanceOrderResponse })
  @ApiResponse({ status: 422, description: 'ORDER_ALREADY_CLOSED / AUTO_TRANSACTION_IMMUTABLE' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceOrderDto,
    @Scope() scope: BranchScope,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceOrderResponse> {
    const order = await this.maintenance.update(id, dto, scope, actorOf(req), locale);
    return toMaintenanceOrderResponse(order, locale);
  }

  @Post(':id/send')
  @HttpCode(200)
  @Permissions(Perm.MAINTENANCE_UPDATE)
  @ApiOperation({
    summary: 'Dispatch the machine, creating the outbound transfer',
    description:
      'The transfer type comes from the maintenance location, never from the client: the ' +
      "destination is what decides the machine's status while it is away.",
  })
  @ApiResponse({ status: 200, type: MaintenanceOrderResponse })
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMaintenanceOrderDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceOrderResponse> {
    const order = await this.maintenance.send(id, dto, actorOf(req), locale);
    return toMaintenanceOrderResponse(order, locale);
  }

  @Post(':id/receive')
  @HttpCode(200)
  @Permissions(Perm.MAINTENANCE_UPDATE)
  @ApiOperation({ summary: 'Book the same serial back in, creating the return transfer' })
  @ApiResponse({ status: 200, type: MaintenanceOrderResponse })
  async receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveMaintenanceOrderDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceOrderResponse> {
    const order = await this.maintenance.receive(id, dto, actorOf(req), locale);
    return toMaintenanceOrderResponse(order, locale);
  }

  /**
   * `maintenance.set_cost` is required alongside `maintenance.close` because closing is where the
   * money is decided (`11`): the two permissions exist so that recording an outcome and deciding
   * who pays for it can be held by different people.
   */
  @Post(':id/close')
  @HttpCode(200)
  @Idempotent()
  @Permissions(Perm.MAINTENANCE_CLOSE, Perm.MAINTENANCE_SET_COST)
  @ApiOperation({ summary: 'Record the outcome, the cost and who pays; posts the money' })
  @ApiResponse({ status: 200, type: MaintenanceOrderResponse })
  @ApiResponse({ status: 400, description: 'COST_REQUIRED / REPLACEMENT_PAYLOAD_REQUIRED' })
  @ApiResponse({ status: 409, description: 'ORDER_ALREADY_CLOSED' })
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseMaintenanceOrderDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceOrderResponse> {
    const outcome = await this.maintenance.close(id, dto, actorOf(req), locale);
    return toMaintenanceOrderResponse(outcome.order, locale, outcome.replacementMachineId);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Permissions(Perm.MAINTENANCE_UPDATE)
  @ApiOperation({ summary: 'Abandon the order; the machine must be back first' })
  @ApiResponse({ status: 200, type: MaintenanceOrderResponse })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelMaintenanceOrderDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceOrderResponse> {
    const order = await this.maintenance.cancel(id, dto, actorOf(req), locale);
    return toMaintenanceOrderResponse(order, locale);
  }
}

/** Signatures record where they were taken from; the rest of the request is already validated. */
function actorOf(req: RequestContext): MaintenanceActor {
  return { user: req.user!, ipAddress: req.ip ?? null };
}

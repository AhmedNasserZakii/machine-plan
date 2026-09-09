import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
import { BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  QueryDecommissionCandidatesDto,
  QueryMachineTimelineDto,
} from './dto/machine-insights.dto';
import {
  BulkCreateMachinesDto,
  CreateMachineDto,
  LookupMachineDto,
  QueryMachinesDto,
  UpdateMachineDto,
} from './dto/machine.dto';
import {
  DecommissionCandidateResponse,
  MachineCostSummaryResponse,
  MachineTimelineEventResponse,
  ReplacementChainResponse,
} from './dto/responses/machine-insights.response';
import {
  BulkCreateMachinesResponse,
  MachineListItemResponse,
  MachineLookupResponse,
  MachineResponse,
} from './dto/responses/machine.response';
import { toMachineListItemResponse, toMachineResponse } from './mappers/machine.mapper';
import { MachineInsightsService } from './machine-insights.service';
import { MachinesService } from './machines.service';

@ApiTags('machines')
@ApiBearerAuth('access-token')
@Controller({ path: 'machines', version: '1' })
export class MachinesController {
  constructor(
    private readonly machines: MachinesService,
    private readonly insights: MachineInsightsService,
  ) {}

  @Get()
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'List machines; branch-scoped unless the caller has machines.read.all' })
  @ApiResponse({ status: 200, type: [MachineListItemResponse] })
  async findAll(
    @Query() query: QueryMachinesDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<MachineListItemResponse>> {
    const page = await this.machines.findAll(query, scope, locale);
    return page.map((machine) => toMachineListItemResponse(machine, locale));
  }

  /**
   * Declared before `:id` so `lookup` is not parsed as a machine id — Nest matches routes in
   * declaration order and `ParseUUIDPipe` would reject the literal first.
   */
  @Get('lookup')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Resolve a scanned code against machine, battery, SIM or box serial' })
  @ApiResponse({ status: 200, type: MachineLookupResponse })
  @ApiResponse({ status: 404, description: 'MACHINE_NOT_FOUND' })
  async lookup(
    @Query() query: LookupMachineDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<MachineLookupResponse> {
    const result = await this.machines.lookup(query.code, scope, locale);
    return { matchedOn: result.matchedOn, machine: toMachineResponse(result.machine, locale) };
  }

  /**
   * Also declared before `:id`, and for the same reason: `ParseUUIDPipe` would reject the literal
   * segment before Nest ever reached this handler.
   */
  @Get('decommission-candidates')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Machines whose repair bill has passed the configured thresholds' })
  @ApiResponse({ status: 200, type: [DecommissionCandidateResponse] })
  decommissionCandidates(
    @Query() query: QueryDecommissionCandidatesDto,
    @Scope() scope: BranchScope,
  ): Promise<PaginatedResult<DecommissionCandidateResponse>> {
    return this.insights.decommissionCandidates(query, scope);
  }

  @Get('by-serial/:serial')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Get one machine by its printed serial' })
  @ApiResponse({ status: 200, type: MachineResponse })
  async findBySerial(
    @Param('serial') serial: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<MachineResponse> {
    return toMachineResponse(await this.machines.findBySerial(serial, scope, locale), locale);
  }

  @Get(':id')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Get one machine' })
  @ApiResponse({ status: 200, type: MachineResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<MachineResponse> {
    return toMachineResponse(await this.machines.findById(id, scope, locale), locale);
  }

  @Get(':id/replacement-chain')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({
    summary: 'Every serial this unit has ever been, oldest first, with chain totals',
  })
  @ApiResponse({ status: 200, type: ReplacementChainResponse })
  replacementChain(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<ReplacementChainResponse> {
    return this.insights.replacementChain(id, scope, locale);
  }

  @Get(':id/timeline')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'The full life story, newest first, keyset-paginated' })
  @ApiResponse({ status: 200, type: [MachineTimelineEventResponse] })
  timeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryMachineTimelineDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<CursorResult<MachineTimelineEventResponse>> {
    return this.insights.timeline(id, query, scope, locale);
  }

  /**
   * Gated on `maintenance.read` rather than `machines.read` (`07`): this is the repair bill and
   * the scrap-it advice, which is a management read, not part of looking a machine up in the field.
   */
  @Get(':id/cost-summary')
  @Permissions(Perm.MAINTENANCE_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Purchase price against repair spend, with a keep-or-scrap verdict' })
  @ApiResponse({ status: 200, type: MachineCostSummaryResponse })
  costSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<MachineCostSummaryResponse> {
    return this.insights.costSummary(id, scope, locale);
  }

  @Post()
  @Idempotent()
  @Permissions(Perm.MACHINES_CREATE)
  @ApiOperation({ summary: 'Register one machine with its battery' })
  @ApiResponse({ status: 201, type: MachineResponse })
  @ApiResponse({
    status: 409,
    description: 'SERIAL_EXISTS / SIM_SERIAL_EXISTS / BOX_SERIAL_EXISTS',
  })
  async create(
    @Body() dto: CreateMachineDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<MachineResponse> {
    return toMachineResponse(await this.machines.create(dto, actorId, locale), locale);
  }

  @Post('bulk')
  @Permissions(Perm.MACHINES_IMPORT)
  @ApiOperation({ summary: 'Factory intake: validates the whole batch, then commits all or none' })
  @ApiResponse({ status: 201, type: BulkCreateMachinesResponse })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED with a per-row detail list' })
  async bulkCreate(
    @Body() dto: BulkCreateMachinesDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<BulkCreateMachinesResponse> {
    const machines = await this.machines.bulkCreate(dto, actorId, locale);

    return {
      created: machines.length,
      machines: machines.map((machine) => toMachineResponse(machine, locale)),
    };
  }

  @Patch(':id')
  @Permissions(Perm.MACHINES_UPDATE)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Update the editable fields; serials are immutable' })
  @ApiResponse({ status: 200, type: MachineResponse })
  @ApiResponse({ status: 422, description: 'SERIAL_IMMUTABLE' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMachineDto,
    @Scope() scope: BranchScope,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<MachineResponse> {
    return toMachineResponse(await this.machines.update(id, dto, scope, actorId, locale), locale);
  }
}

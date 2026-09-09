import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { BranchScoped, Permissions, ReqLocale, Scope } from 'src/common/decorators';
import { BranchScope, RequestContext } from 'src/common/types/request.types';
import { MachinesService } from 'src/modules/machines/machines.service';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { DecommissionMachineDto, RevertDecommissionDto } from './dto/decommission.dto';
import { DecommissionResponse } from './dto/responses/decommission.response';
import { DecommissionActor, DecommissionsService } from './decommissions.service';
import { toDecommissionResponse } from './mappers/decommission.mapper';

@ApiTags('decommissions')
@ApiBearerAuth('access-token')
@Controller({ path: 'machines', version: '1' })
export class MachineDecommissionController {
  constructor(
    private readonly decommissions: DecommissionsService,
    private readonly machines: MachinesService,
  ) {}

  @Get(':id/decommission')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Why this machine was scrapped, and what it had cost by then' })
  @ApiResponse({ status: 200, type: DecommissionResponse })
  @ApiResponse({ status: 404, description: 'DECOMMISSION_NOT_FOUND — the machine is still in use' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<DecommissionResponse> {
    const machine = await this.machines.findById(id, scope, locale);
    return toDecommissionResponse(
      await this.decommissions.findByMachine(machine.id, locale),
      locale,
    );
  }

  @Post(':id/decommission')
  @Permissions(Perm.MACHINES_DECOMMISSION)
  @ApiOperation({
    summary: 'End of life: freeze the economics and move the unit to the scrap store',
    description:
      'Always a human decision (`13`, rule 1). The candidates list recommends; this endpoint is ' +
      'the only thing that acts.',
  })
  @ApiResponse({ status: 201, type: DecommissionResponse })
  @ApiResponse({ status: 409, description: 'ALREADY_DECOMMISSIONED / OPEN_MAINTENANCE_ORDER' })
  @ApiResponse({ status: 422, description: 'MACHINE_NOT_IN_WAREHOUSE' })
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecommissionMachineDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<DecommissionResponse> {
    const row = await this.decommissions.decommission(id, dto, actorOf(req), locale);
    return toDecommissionResponse(row, locale);
  }

  /**
   * Guarded by `settings.manage` (`13`, rule 3): reversing an end-of-life decision is an
   * administrative correction, deliberately not held by whoever may take the decision.
   */
  @Post(':id/decommission/revert')
  @HttpCode(200)
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({
    summary: 'It was a mistake: bring the machine back, with a reason on the record',
  })
  @ApiResponse({ status: 200, type: DecommissionResponse })
  @ApiResponse({ status: 404, description: 'DECOMMISSION_NOT_FOUND' })
  async revert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevertDecommissionDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<DecommissionResponse> {
    const row = await this.decommissions.revert(id, dto, actorOf(req), locale);
    return toDecommissionResponse(row, locale);
  }
}

function actorOf(req: RequestContext): DecommissionActor {
  return { user: req.user!, ipAddress: req.ip ?? null };
}

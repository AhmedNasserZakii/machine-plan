import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { BranchScoped, Permissions, ReqLocale, Scope } from 'src/common/decorators';
import { BranchScope, RequestContext } from 'src/common/types/request.types';
import { MachinesService } from 'src/modules/machines/machines.service';
import { ReplacementMachineDto } from 'src/modules/replacements/dto/replacement.dto';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { MaintenanceHistoryResponse } from './dto/responses/maintenance.response';
import { QueryMachineMaintenanceHistoryDto } from './dto/maintenance.dto';
import { MachineReplacedResponse } from './dto/responses/replace.response';
import { toMaintenanceListItemResponse } from './mappers/maintenance.mapper';
import { MaintenanceActor, MaintenanceService } from './maintenance.service';

/**
 * The two machine-scoped routes maintenance owns. They live here rather than on
 * `MachinesController` because the logic behind them is maintenance's: `MachinesModule` is
 * imported by this module, and importing it back would close the cycle.
 */
@ApiTags('maintenance')
@ApiBearerAuth('access-token')
@Controller({ path: 'machines', version: '1' })
export class MachineMaintenanceController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly machines: MachinesService,
  ) {}

  @Get(':id/maintenance-history')
  @Permissions(Perm.MAINTENANCE_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Every repair this machine has had, with the totals' })
  @ApiResponse({ status: 200, type: MaintenanceHistoryResponse })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryMachineMaintenanceHistoryDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<MaintenanceHistoryResponse> {
    // Visibility is the machine's, checked by the module that owns it. A history endpoint that
    // enforced its own idea of scope would be a second answer to the same question.
    const machine = await this.machines.findById(id, scope, locale);
    const { orders, totals, ordersMeta } = await this.maintenance.historyOf(
      machine.id,
      locale,
      query,
    );

    return {
      machineId: machine.id,
      serial: machine.serial,
      totals,
      orders: orders.map((order) => toMaintenanceListItemResponse(order, locale)),
      ordersMeta,
    };
  }

  /**
   * The factory swap (`12`). Gated on both permissions the spec names: it creates a machine
   * record, and it concludes the repair the old one was sent away for.
   */
  @Post(':id/replace')
  @Permissions(Perm.MACHINES_CREATE, Perm.MAINTENANCE_CLOSE)
  @ApiOperation({ summary: 'Record that the factory returned a different unit' })
  @ApiResponse({ status: 201, type: MachineReplacedResponse })
  @ApiResponse({ status: 409, description: 'MACHINE_ALREADY_REPLACED / SERIAL_EXISTS' })
  @ApiResponse({ status: 422, description: 'INVALID_MACHINE_STATUS / MACHINE_RETIRED' })
  async replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacementMachineDto,
    @Req() req: RequestContext,
  ): Promise<MachineReplacedResponse> {
    const outcome = await this.maintenance.replaceMachine(id, dto, actorOf(req));

    return {
      oldMachineId: id,
      newMachineId: outcome.newMachineId,
      maintenanceOrderId: outcome.maintenanceOrderId,
    };
  }
}

function actorOf(req: RequestContext): MaintenanceActor {
  return { user: req.user!, ipAddress: req.ip ?? null };
}

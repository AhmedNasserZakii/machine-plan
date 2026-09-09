import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from 'src/common/decorators';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { CreateWarehouseDto, QueryWarehousesDto } from './dto/warehouse.dto';
import { WarehouseResponse } from './dto/responses/branch.response';
import { toWarehouseResponse } from './mappers/branch.mapper';
import { WarehousesService } from './warehouses.service';

@ApiTags('warehouses')
@ApiBearerAuth('access-token')
@Controller({ path: 'warehouses', version: '1' })
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @ApiOperation({ summary: 'List warehouses, optionally filtered by type or branch' })
  @ApiResponse({ status: 200, type: [WarehouseResponse] })
  async findAll(@Query() query: QueryWarehousesDto): Promise<WarehouseResponse[]> {
    const warehouses = await this.warehouses.findAll(query);
    return warehouses.map(toWarehouseResponse);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one warehouse' })
  @ApiResponse({ status: 200, type: WarehouseResponse })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<WarehouseResponse> {
    return toWarehouseResponse(await this.warehouses.findById(id));
  }

  @Post()
  @Permissions(Perm.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Create a warehouse' })
  @ApiResponse({ status: 201, type: WarehouseResponse })
  @ApiResponse({
    status: 409,
    description: 'WAREHOUSE_TYPE_CONFLICT — a COMPANY_MAIN, SCRAP or branch warehouse exists',
  })
  async create(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser('id') actorId: string,
  ): Promise<WarehouseResponse> {
    return toWarehouseResponse(await this.warehouses.create(dto, actorId));
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from 'src/common/decorators';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { CreateSupplierDto, QuerySuppliersDto } from './dto/supplier.dto';
import { SupplierResponse } from './dto/responses/supplier.response';
import { toSupplierResponse } from './mappers/supplier.mapper';
import { SuppliersService } from './services/suppliers.service';

/**
 * Gated on `finance.create` rather than `settings.manage`: whoever can book the expense has to be
 * able to name the shop it was paid to, in the same breath (`15`).
 */
@ApiTags('finance')
@ApiBearerAuth('access-token')
@Controller({ path: 'suppliers', version: '1' })
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @Permissions(Perm.FINANCE_READ)
  @ApiOperation({ summary: 'List suppliers' })
  @ApiResponse({ status: 200, type: [SupplierResponse] })
  async findAll(@Query() query: QuerySuppliersDto): Promise<SupplierResponse[]> {
    const rows = await this.suppliers.findAll(query);
    return rows.map(toSupplierResponse);
  }

  @Post()
  @Permissions(Perm.FINANCE_CREATE)
  @ApiOperation({ summary: 'Register a supplier' })
  @ApiResponse({ status: 201, type: SupplierResponse })
  async create(
    @Body() dto: CreateSupplierDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SupplierResponse> {
    return toSupplierResponse(await this.suppliers.create(dto, actorId));
  }
}

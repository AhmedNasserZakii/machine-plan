import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { BranchScoped, Permissions, ReqLocale, Scope } from 'src/common/decorators';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { QueryDecommissionsDto } from './dto/decommission.dto';
import { DecommissionResponse } from './dto/responses/decommission.response';
import { DecommissionsService } from './decommissions.service';
import { toDecommissionResponse } from './mappers/decommission.mapper';

@ApiTags('decommissions')
@ApiBearerAuth('access-token')
@Controller({ path: 'decommissions', version: '1' })
export class DecommissionsController {
  constructor(private readonly decommissions: DecommissionsService) {}

  @Get()
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Everything the company has scrapped, newest first' })
  @ApiResponse({ status: 200, type: [DecommissionResponse] })
  async findAll(
    @Query() query: QueryDecommissionsDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<DecommissionResponse>> {
    const page = await this.decommissions.findAll(query, scope, locale);
    return page.map((row) => toDecommissionResponse(row, locale));
  }
}

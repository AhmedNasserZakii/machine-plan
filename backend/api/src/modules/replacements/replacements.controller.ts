import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BranchScoped, Permissions, Scope } from 'src/common/decorators';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { QueryReplacementsDto } from './dto/replacement.dto';
import { ReplacementResponse } from './dto/responses/replacement.response';
import { toReplacementResponse } from './mappers/replacement.mapper';
import { ReplacementsService } from './replacements.service';

/**
 * The swap log. Creating a replacement is not here: it concludes a maintenance order, so it lives
 * with maintenance (`POST /machines/:id/replace`).
 */
@ApiTags('replacements')
@ApiBearerAuth('access-token')
@Controller({ path: 'replacements', version: '1' })
export class ReplacementsController {
  constructor(private readonly replacements: ReplacementsService) {}

  @Get()
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Every factory swap, newest first' })
  @ApiResponse({ status: 200, type: [ReplacementResponse] })
  async findAll(
    @Query() query: QueryReplacementsDto,
    @Scope() scope: BranchScope,
  ): Promise<PaginatedResult<ReplacementResponse>> {
    const page = await this.replacements.findAll(query, scope);
    return page.map(toReplacementResponse);
  }
}

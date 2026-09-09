import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BranchScoped, CurrentUser, Permissions, Scope } from 'src/common/decorators';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { BranchesService } from './branches.service';
import { CreateBranchDto, QueryBranchesDto, UpdateBranchDto } from './dto/branch.dto';
import { BranchResponse, BranchSummaryResponse } from './dto/responses/branch.response';
import { toBranchResponse } from './mappers/branch.mapper';

@ApiTags('branches')
@ApiBearerAuth('access-token')
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  /** Open to any authenticated user: every machine and transfer form needs the branch list. */
  @Get()
  @ApiOperation({ summary: 'List branches with their warehouse' })
  @ApiResponse({ status: 200, type: [BranchResponse] })
  async findAll(@Query() query: QueryBranchesDto): Promise<BranchResponse[]> {
    const branches = await this.branches.findAll(query);
    return branches.map((branch) => toBranchResponse(branch));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one branch' })
  @ApiResponse({ status: 200, type: BranchResponse })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BranchResponse> {
    return toBranchResponse(await this.branches.findById(id));
  }

  @Get(':id/summary')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({
    summary: 'Dashboard counts for a branch; the finance block needs `finance.read.all`',
  })
  @ApiResponse({ status: 200, type: BranchSummaryResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND — also returned for another branch' })
  async summary(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ): Promise<BranchSummaryResponse> {
    // `finance.read` is the branch-limited grant; this block is a whole branch's monthly
    // totals, which is what `finance.read.all` gates everywhere else in the ledger.
    const includeFinance = user.permissions.includes(Perm.FINANCE_READ_ALL);
    return this.branches.summary(id, scope, includeFinance);
  }

  @Post()
  @Permissions(Perm.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Create a branch and its warehouse' })
  @ApiResponse({ status: 201, type: BranchResponse })
  @ApiResponse({ status: 409, description: 'BRANCH_CODE_EXISTS' })
  async create(
    @Body() dto: CreateBranchDto,
    @CurrentUser('id') actorId: string,
  ): Promise<BranchResponse> {
    return toBranchResponse(await this.branches.create(dto, actorId));
  }

  @Patch(':id')
  @Permissions(Perm.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Update a branch' })
  @ApiResponse({ status: 200, type: BranchResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser('id') actorId: string,
  ): Promise<BranchResponse> {
    return toBranchResponse(await this.branches.update(id, dto, actorId));
  }

  @Patch(':id/deactivate')
  @Permissions(Perm.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Deactivate a branch that holds no machines and no active staff' })
  @ApiResponse({ status: 200, type: BranchResponse })
  @ApiResponse({ status: 409, description: 'BRANCH_HAS_MACHINES / BRANCH_HAS_ACTIVE_STAFF' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<BranchResponse> {
    return toBranchResponse(await this.branches.deactivate(id, actorId));
  }

  @Patch(':id/activate')
  @Permissions(Perm.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Re-activate a branch' })
  @ApiResponse({ status: 200, type: BranchResponse })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<BranchResponse> {
    return toBranchResponse(await this.branches.activate(id, actorId));
  }
}

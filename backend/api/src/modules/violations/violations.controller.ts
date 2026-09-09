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
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  ChargeViolationDto,
  CreateViolationDto,
  QueryViolationsDto,
  UpdateViolationDto,
  WaiveViolationDto,
} from './dto/violation.dto';
import { ViolationResponse, ViolationSummaryResponse } from './dto/responses/violation.response';
import { toViolationResponse } from './mappers/violation.mapper';
import { ViolationsService } from './violations.service';

@ApiTags('violations')
@ApiBearerAuth('access-token')
@Controller({ path: 'violations', version: '1' })
export class ViolationsController {
  constructor(private readonly violations: ViolationsService) {}

  @Get()
  @Permissions(Perm.VIOLATIONS_READ)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'List violations; a representative always sees his own file' })
  @ApiResponse({ status: 200, type: [ViolationResponse] })
  async findAll(
    @Query() query: QueryViolationsDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<ViolationResponse>> {
    const page = await this.violations.findAll(query, scope, actor, locale);
    return page.map((violation) => toViolationResponse(violation, locale));
  }

  @Get(':id')
  @Permissions(Perm.VIOLATIONS_READ)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'One violation' })
  @ApiResponse({ status: 200, type: ViolationResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationResponse> {
    return toViolationResponse(await this.violations.findById(id, scope, actor, locale), locale);
  }

  @Post()
  @Idempotent()
  @Permissions(Perm.VIOLATIONS_CREATE)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'File a violation by hand — something the scanner could not see' })
  @ApiResponse({ status: 201, type: ViolationResponse })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED — subject outside your branch' })
  async create(
    @Body() dto: CreateViolationDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationResponse> {
    return toViolationResponse(await this.violations.create(dto, scope, actor, locale), locale);
  }

  /**
   * Gated on `violations.read` rather than `resolve`: this is the representative telling the system
   * he has seen it, which is the one transition he is meant to make himself.
   */
  @Post(':id/acknowledge')
  @HttpCode(200)
  @Permissions(Perm.VIOLATIONS_READ)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'Mark a violation as seen' })
  @ApiResponse({ status: 200, type: ViolationResponse })
  async acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationResponse> {
    return toViolationResponse(await this.violations.acknowledge(id, scope, actor, locale), locale);
  }

  @Patch(':id')
  @Permissions(Perm.VIOLATIONS_RESOLVE)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'Revise a manually filed violation' })
  @ApiResponse({ status: 200, type: ViolationResponse })
  @ApiResponse({ status: 422, description: 'AUTO_VIOLATION_IMMUTABLE' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViolationDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationResponse> {
    return toViolationResponse(await this.violations.update(id, dto, scope, actor, locale), locale);
  }

  @Post(':id/charge')
  @HttpCode(200)
  @Permissions(Perm.VIOLATIONS_RESOLVE, Perm.FINANCE_CREATE)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'Put a figure on it; the only way a violation produces money' })
  @ApiResponse({ status: 200, type: ViolationResponse })
  @ApiResponse({ status: 409, description: 'ALREADY_CHARGED' })
  async charge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChargeViolationDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationResponse> {
    return toViolationResponse(await this.violations.charge(id, dto, scope, actor, locale), locale);
  }

  @Post(':id/waive')
  @HttpCode(200)
  @Permissions(Perm.VIOLATIONS_WAIVE)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: 'Forgive it, with a reason. The entry is kept either way' })
  @ApiResponse({ status: 200, type: ViolationResponse })
  async waive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WaiveViolationDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationResponse> {
    return toViolationResponse(await this.violations.waive(id, dto, scope, actor, locale), locale);
  }
}

/**
 * The summary hangs off the user, not the violation, because that is how it is reached: a Director
 * opens a representative and wants his file, not a filtered list he has to total up himself.
 */
@ApiTags('violations')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UserViolationsController {
  constructor(private readonly violations: ViolationsService) {}

  @Get(':id/violations')
  @Permissions(Perm.VIOLATIONS_READ)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: "A user's violations, with the standard filters and pagination" })
  @ApiResponse({ status: 200, type: [ViolationResponse] })
  async findForUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryViolationsDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<ViolationResponse>> {
    // The route parameter is authoritative. A caller cannot replace the subject with a query
    // parameter, and the ordinary service continues to enforce branch/self visibility.
    const page = await this.violations.findAll(
      Object.assign(query, { userId: id }),
      scope,
      actor,
      locale,
    );
    return page.map((violation) => toViolationResponse(violation, locale));
  }

  @Get(':id/violations/summary')
  @Permissions(Perm.VIOLATIONS_READ)
  @BranchScoped(Perm.VIOLATIONS_READ_ALL)
  @ApiOperation({ summary: "A representative's whole disciplinary file, totalled" })
  @ApiResponse({ status: 200, type: ViolationSummaryResponse })
  async summary(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationSummaryResponse> {
    return this.violations.summary(id, scope, actor, locale);
  }
}

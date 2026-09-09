import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/common/decorators';
import { CursorResult } from 'src/common/dto/paginated-result';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AuditLogResponse } from './dto/responses/audit-log.response';
import { toAuditLogResponse } from './mappers/audit-log.mapper';

/**
 * Company-wide rather than branch-scoped, like `/roles` and `/settings`: `audit.read` is an
 * administrative capability, not a branch one, and no role below Director holds it (`21`).
 */
@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditLogsController {
  constructor(private readonly logs: AuditLogsService) {}

  @Get()
  @Permissions(Perm.AUDIT_READ)
  @ApiOperation({ summary: 'The audit trail, newest first, with the planned filters' })
  @ApiResponse({ status: 200, type: [AuditLogResponse] })
  async findAll(@Query() query: QueryAuditLogsDto): Promise<CursorResult<AuditLogResponse>> {
    return (await this.logs.findAll(query)).map(toAuditLogResponse);
  }

  @Get('entity/:type/:id')
  @Permissions(Perm.AUDIT_READ)
  @ApiOperation({ summary: 'Every event recorded against one entity — "who touched this"' })
  @ApiResponse({ status: 200, type: [AuditLogResponse] })
  async findByEntity(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryAuditLogsDto,
  ): Promise<CursorResult<AuditLogResponse>> {
    return (await this.logs.findByEntity(type, id, query)).map(toAuditLogResponse);
  }

  @Get('user/:userId')
  @Permissions(Perm.AUDIT_READ)
  @ApiOperation({ summary: 'Every event a given user is the actor of' })
  @ApiResponse({ status: 200, type: [AuditLogResponse] })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: QueryAuditLogsDto,
  ): Promise<CursorResult<AuditLogResponse>> {
    return (await this.logs.findByUser(userId, query)).map(toAuditLogResponse);
  }
}

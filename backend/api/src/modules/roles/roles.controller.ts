import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { CurrentUser, Permissions, ReqLocale } from 'src/common/decorators';
import { AuthUser } from 'src/common/types/request.types';
import { Perm } from './permissions.catalogue';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/create-role.dto';
import { PermissionGroupResponse } from './dto/responses/permission.response';
import { RoleResponse } from './dto/responses/role.response';
import { toPermissionGroups, toRoleResponse } from './mappers/role.mapper';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('roles')
  @Permissions(Perm.USERS_READ)
  @ApiOperation({ summary: 'List roles with their permission codes' })
  @ApiQuery({ name: 'raw_translations', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [RoleResponse] })
  async findAll(
    @ReqLocale() locale: Locale,
    @Query('raw_translations') rawTranslations?: string,
  ): Promise<RoleResponse[]> {
    const roles = await this.roles.findAll();
    const includeRaw = rawTranslations === 'true';
    return roles.map((role) => toRoleResponse(role, locale, includeRaw));
  }

  @Get('roles/:id')
  @Permissions(Perm.USERS_READ)
  @ApiOperation({ summary: 'Get one role' })
  @ApiResponse({ status: 200, type: RoleResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLocale() locale: Locale,
  ): Promise<RoleResponse> {
    return toRoleResponse(await this.roles.findById(id), locale);
  }

  @Post('roles')
  @Permissions(Perm.ROLES_MANAGE)
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiResponse({ status: 201, type: RoleResponse })
  @ApiResponse({ status: 409, description: 'CODE_EXISTS' })
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<RoleResponse> {
    return toRoleResponse(await this.roles.create(dto, actorId), locale);
  }

  @Patch('roles/:id')
  @Permissions(Perm.ROLES_MANAGE)
  @ApiOperation({ summary: 'Rename a role in one or more locales' })
  @ApiResponse({ status: 200, type: RoleResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<RoleResponse> {
    return toRoleResponse(await this.roles.update(id, dto, actorId), locale);
  }

  @Put('roles/:id/permissions')
  @Permissions(Perm.ROLES_MANAGE)
  @ApiOperation({ summary: 'Replace a role permission set' })
  @ApiResponse({ status: 200, type: RoleResponse })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED — unknown permission code' })
  @ApiResponse({
    status: 403,
    description: 'CANNOT_EDIT_OWN_PERMISSIONS | INSUFFICIENT_PERMISSIONS',
  })
  @ApiResponse({
    status: 422,
    description: 'SYSTEM_ROLE_PROTECTED — the Director role is immutable',
  })
  async setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<RoleResponse> {
    return toRoleResponse(await this.roles.setPermissions(id, dto.permissions, actor), locale);
  }

  @Get('permissions')
  @Permissions(Perm.ROLES_MANAGE)
  @ApiOperation({ summary: 'The permission catalogue, grouped and localized for a checkbox tree' })
  @ApiResponse({ status: 200, type: [PermissionGroupResponse] })
  async listPermissions(@ReqLocale() locale: Locale): Promise<PermissionGroupResponse[]> {
    return toPermissionGroups(await this.roles.listPermissions(), locale);
  }
}

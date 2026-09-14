import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { BranchScoped, CurrentUser, Permissions, ReqLocale, Scope } from 'src/common/decorators';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserCustodyDto, QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto, SetUserPermissionsDto, UpdateUserDto } from './dto/update-user.dto';
import {
  ResetPasswordResponse,
  UserPermissionsResponse,
  UserResponse,
} from './dto/responses/user.response';
import { toUserResponse } from './mappers/user.mapper';
import { UsersService } from './users.service';
import { UserCustodyResponse } from './dto/responses/user-custody.response';
import { UserCustodyService } from './user-custody.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly custody: UserCustodyService,
  ) {}

  @Get()
  @Permissions(Perm.USERS_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'List users, scoped to the caller branch unless they can read all' })
  @ApiResponse({ status: 200, type: [UserResponse] })
  async findAll(
    @Query() query: QueryUsersDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<PaginatedResult<UserResponse>> {
    const result = await this.users.findAll(query, scope.unrestricted ? null : scope.branchId);
    return result.map((user) => toUserResponse(user, locale));
  }

  @Get(':id')
  @Permissions(Perm.USERS_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Get one user' })
  @ApiResponse({ status: 200, type: UserResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND — also returned for out-of-scope users' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<UserResponse> {
    const user = await this.users.findById(id, scope.unrestricted ? null : scope.branchId);
    return toUserResponse(user, locale);
  }

  @Get(':id/custody')
  @Permissions(Perm.MACHINES_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: "Machines in a user's hand and at merchants assigned to them" })
  @ApiResponse({ status: 200, type: UserCustodyResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND — also returned for an out-of-scope user' })
  custodyForUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryUserCustodyDto,
    @Scope() scope: BranchScope,
    @ReqLocale() locale: Locale,
  ): Promise<UserCustodyResponse> {
    return this.custody.findForUser(id, scope.unrestricted ? null : scope.branchId, locale, query);
  }

  @Post()
  @Permissions(Perm.USERS_CREATE)
  @ApiOperation({ summary: 'Create an account with a temporary password' })
  @ApiResponse({ status: 201, type: UserResponse })
  @ApiResponse({ status: 400, description: 'BRANCH_REQUIRED_FOR_ROLE' })
  @ApiResponse({ status: 409, description: 'PHONE_EXISTS | EMAIL_EXISTS' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<UserResponse> {
    return toUserResponse(await this.users.create(dto, actor), locale);
  }

  @Patch(':id')
  @Permissions(Perm.USERS_UPDATE)
  @ApiOperation({ summary: 'Update a user profile, role or branch' })
  @ApiResponse({ status: 200, type: UserResponse })
  @ApiResponse({ status: 403, description: 'CANNOT_EDIT_OWN_PERMISSIONS' })
  @ApiResponse({ status: 422, description: 'LAST_DIRECTOR' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<UserResponse> {
    return toUserResponse(await this.users.update(id, dto, actor), locale);
  }

  @Patch(':id/deactivate')
  @Permissions(Perm.USERS_DEACTIVATE)
  @ApiOperation({ summary: 'Deactivate a user and revoke their sessions' })
  @ApiResponse({ status: 200, type: UserResponse })
  @ApiResponse({ status: 409, description: 'USER_HAS_CUSTODY — move their machines first' })
  @ApiResponse({ status: 422, description: 'LAST_DIRECTOR' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<UserResponse> {
    return toUserResponse(await this.users.deactivate(id, actor), locale);
  }

  @Patch(':id/activate')
  @Permissions(Perm.USERS_DEACTIVATE)
  @ApiOperation({ summary: 'Re-activate a user' })
  @ApiResponse({ status: 200, type: UserResponse })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<UserResponse> {
    return toUserResponse(await this.users.activate(id, actor), locale);
  }

  @Post(':id/reset-password')
  @Permissions(Perm.USERS_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a password and force a change on next login' })
  @ApiResponse({ status: 200, type: ResetPasswordResponse })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_PERMISSIONS — target outranks you' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ResetPasswordResponse> {
    return this.users.resetPassword(id, dto, actor);
  }

  @Get(':id/permissions')
  @Permissions(Perm.USERS_READ)
  @BranchScoped(Perm.MACHINES_READ_ALL)
  @ApiOperation({ summary: 'Role grants, overrides and the resulting effective set' })
  @ApiResponse({ status: 200, type: UserPermissionsResponse })
  getPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
  ): Promise<UserPermissionsResponse> {
    return this.users.getPermissions(id, scope.unrestricted ? null : scope.branchId);
  }

  @Put(':id/permissions')
  @Permissions(Perm.ROLES_MANAGE)
  @ApiOperation({ summary: 'Replace a user ALLOW/DENY overrides' })
  @ApiResponse({ status: 200, type: UserPermissionsResponse })
  @ApiResponse({ status: 403, description: 'CANNOT_EDIT_OWN_PERMISSIONS' })
  async setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPermissionsDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserPermissionsResponse> {
    await this.users.setPermissions(id, dto, actor);
    return this.users.getPermissions(id);
  }
}

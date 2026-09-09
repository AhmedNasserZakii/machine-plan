import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { AllowPasswordChangePending, CurrentUser, Public, ReqLocale } from 'src/common/decorators';
import { AuthUser, RequestContext } from 'src/common/types/request.types';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { EnrollBiometricDto, RegisterDeviceDto } from './dto/register-device.dto';
import { AuthTokensResponse } from './dto/responses/auth-tokens.response';
import { MeResponse } from './dto/responses/me.response';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with phone and password' })
  @ApiResponse({ status: 200, type: AuthTokensResponse })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  @ApiResponse({ status: 403, description: 'ACCOUNT_INACTIVE' })
  @ApiResponse({ status: 429, description: 'ACCOUNT_LOCKED' })
  login(@Body() dto: LoginDto, @Req() request: RequestContext): Promise<AuthTokensResponse> {
    return this.auth.login(dto, { ip: request.ip ?? 'unknown', deviceId: request.deviceId });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiResponse({ status: 200, type: AuthTokensResponse })
  @ApiResponse({ status: 401, description: 'TOKEN_EXPIRED | TOKEN_REVOKED' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @AllowPasswordChangePending()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the presented refresh token' })
  logout(
    @CurrentUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
  ): Promise<{ revoked: true }> {
    return this.auth.logout(userId, dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @AllowPasswordChangePending()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the caller password; required on first login' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    return this.auth.changePassword(userId, dto);
  }

  @ApiBearerAuth('access-token')
  @AllowPasswordChangePending()
  @Get('me')
  @ApiOperation({ summary: 'Profile, branch and effective permissions' })
  @ApiResponse({ status: 200, type: MeResponse })
  me(@CurrentUser() user: AuthUser, @ReqLocale() locale: Locale): Promise<MeResponse> {
    return this.auth.me(user.id, locale);
  }

  @ApiBearerAuth('access-token')
  @Post('biometric/enroll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trust this device for biometric hand-off confirmation' })
  enrollBiometric(
    @CurrentUser('id') userId: string,
    @Body() dto: EnrollBiometricDto,
  ): Promise<{ enrolled: true }> {
    return this.auth.enrollBiometric(userId, dto);
  }

  @ApiBearerAuth('access-token')
  @Post('devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a device id and its push token' })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ deviceId: string; registered: true }> {
    const device = await this.auth.registerDevice(userId, dto);
    return { deviceId: device.deviceId, registered: true };
  }

  @ApiBearerAuth('access-token')
  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'Unregister a device and revoke its sessions' })
  removeDevice(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ): Promise<{ removed: true }> {
    return this.auth.removeDevice(userId, deviceId);
  }
}

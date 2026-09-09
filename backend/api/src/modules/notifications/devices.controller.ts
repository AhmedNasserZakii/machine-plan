import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators';
import { AuthService } from 'src/modules/auth/auth.service';
import { RegisterDeviceDto } from 'src/modules/auth/dto/register-device.dto';

/**
 * `POST /devices` and `DELETE /devices/:deviceId` of `18`.
 *
 * The registration itself already exists under `/auth/devices` and is not duplicated here: this
 * controller is the address spec 18 gives the push-token endpoints, delegating to the one
 * implementation so a token registered through either path is the same row.
 */
@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or refresh this device’s FCM token' })
  @ApiResponse({ status: 200, description: '{ deviceId, registered }' })
  async register(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ deviceId: string; registered: true }> {
    const device = await this.auth.registerDevice(userId, dto);

    return { deviceId: device.deviceId, registered: true };
  }

  @Delete(':deviceId')
  @ApiOperation({ summary: 'Unregister a device, so nothing is pushed to it again' })
  @ApiResponse({ status: 200, description: '{ removed: true }' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ): Promise<{ removed: true }> {
    return this.auth.removeDevice(userId, deviceId);
  }
}

import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators';
import { UpdateNotificationPreferencesDto } from './dto/notification-preference.dto';
import { NotificationPreferencesResponse } from './dto/responses/notification-preference.response';
import { NotificationPreferencesService } from './services/notification-preferences.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notification-preferences', version: '1' })
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Every template with the caller’s current channel choices',
    description: 'Fixed catalogue of notification templates, bounded by code. Not paginated.',
  })
  @ApiResponse({ status: 200, type: NotificationPreferencesResponse })
  list(@CurrentUser('id') userId: string): Promise<NotificationPreferencesResponse> {
    return this.preferences.list(userId);
  }

  /**
   * `PUT` but partial: only the templates named in the body are touched. A screen that sends one
   * toggle at a time over a bad connection must not have two in-flight requests undo each other.
   */
  @Put()
  @ApiOperation({ summary: 'Change the channels for the templates listed, and the locale' })
  @ApiResponse({ status: 200, type: NotificationPreferencesResponse })
  update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponse> {
    return this.preferences.update(userId, dto);
  }
}

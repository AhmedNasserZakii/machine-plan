import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { MarkAllReadDto, QueryNotificationsDto } from './dto/notification.dto';
import {
  MarkAllReadResponse,
  NotificationResponse,
  UnreadCountResponse,
} from './dto/responses/notification.response';
import { toNotificationResponse } from './mappers/notification.mapper';
import { NotificationsService } from './services/notifications.service';

/**
 * A user's own notifications. No permission guard anywhere in here on purpose: these are
 * addressed to the caller, and there is no role in the catalogue that grants reading somebody
 * else's inbox.
 */
@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'The caller’s notifications, newest first' })
  @ApiResponse({ status: 200, type: [NotificationResponse] })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryNotificationsDto,
  ): Promise<PaginatedResult<NotificationResponse>> {
    const page = await this.notifications.list(userId, query);

    return page.map(toNotificationResponse);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'The badge number' })
  @ApiResponse({ status: 200, type: UnreadCountResponse })
  unreadCount(@CurrentUser('id') userId: string): Promise<UnreadCountResponse> {
    return this.notifications.unreadCount(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  @ApiResponse({ status: 200, type: NotificationResponse })
  @ApiResponse({ status: 404, description: 'NOT_FOUND — including somebody else’s notification' })
  async markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponse> {
    return toNotificationResponse(await this.notifications.markRead(userId, id));
  }

  @Patch('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the badge, optionally only for the ids listed' })
  @ApiResponse({ status: 200, type: MarkAllReadResponse })
  markAllRead(
    @CurrentUser('id') userId: string,
    @Body() dto: MarkAllReadDto,
  ): Promise<MarkAllReadResponse> {
    return this.notifications.markAllRead(userId, dto.ids);
  }
}

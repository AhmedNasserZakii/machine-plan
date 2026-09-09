import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationEntityType,
  NotificationTemplateCode,
  PushSkipReason,
  PushStatus,
} from 'src/common/enums/notification.enum';

export class NotificationResponse {
  @ApiProperty() id: string;
  @ApiProperty({ enum: NotificationTemplateCode }) templateCode: NotificationTemplateCode;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiProperty() locale: string;
  @ApiPropertyOptional({ enum: NotificationEntityType, nullable: true })
  entityType: NotificationEntityType | null;
  @ApiPropertyOptional({ nullable: true }) entityId: string | null;
  @ApiPropertyOptional({ nullable: true }) deepLink: string | null;
  @ApiProperty({ type: Object }) data: Record<string, string>;
  @ApiProperty() isRead: boolean;
  @ApiPropertyOptional({ nullable: true }) readAt: string | null;

  /**
   * What became of the push leg. Exposed rather than kept internal because the client is the
   * only place anybody would notice that a notification arrived in the list and never rang.
   */
  @ApiProperty({ enum: PushStatus }) pushStatus: PushStatus;
  @ApiPropertyOptional({ enum: PushSkipReason, nullable: true })
  pushSkipReason: PushSkipReason | null;

  @ApiProperty() createdAt: string;
}

export class UnreadCountResponse {
  @ApiProperty() unread: number;
}

export class MarkAllReadResponse {
  @ApiProperty() updated: number;
}

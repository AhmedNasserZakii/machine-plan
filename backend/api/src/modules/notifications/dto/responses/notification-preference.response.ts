import { ApiProperty } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';

export class NotificationPreferenceEntryResponse {
  @ApiProperty({ enum: NotificationTemplateCode }) templateCode: NotificationTemplateCode;
  @ApiProperty() push: boolean;
  @ApiProperty() inApp: boolean;

  @ApiProperty({ description: 'In-app cannot be switched off; the client greys the toggle out.' })
  inAppLocked: boolean;
}

export class NotificationPreferencesResponse {
  @ApiProperty({ enum: SUPPORTED_LOCALES }) locale: string;
  @ApiProperty({ type: [NotificationPreferenceEntryResponse] })
  preferences: NotificationPreferenceEntryResponse[];
}

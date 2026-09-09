import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';
import { NOTIFICATION_TEMPLATES } from '../notification-templates.catalogue';

export class NotificationPreferenceEntryDto {
  @ApiProperty({ enum: NotificationTemplateCode })
  @IsEnum(NotificationTemplateCode)
  templateCode: NotificationTemplateCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({
    description: 'Ignored for templates whose in-app delivery is locked on.',
  })
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'The language notifications for this account are written in.',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: 'ar' | 'en';

  @ApiPropertyOptional({ type: [NotificationPreferenceEntryDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  // One entry per template is the most a full screen can send; anything larger is a client bug.
  @ArrayMaxSize(NOTIFICATION_TEMPLATES.length)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceEntryDto)
  preferences?: NotificationPreferenceEntryDto[];
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto, toBoolean } from 'src/common/dto';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';

export class QueryNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only the unread ones — what the app opens the tab on.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ enum: NotificationTemplateCode, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsEnum(NotificationTemplateCode, { each: true })
  @Type(() => String)
  templateCode?: NotificationTemplateCode[];
}

export class MarkAllReadDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Only these notifications. Omitted means every unread one, which is what the "clear all" button sends.',
  })
  @IsOptional()
  @IsArray()
  // The list the client holds is one page; anything larger is a client that should have omitted it.
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids?: string[];
}

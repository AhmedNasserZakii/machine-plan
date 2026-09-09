import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class DateRangeDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Inclusive start date (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Inclusive end date (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateSettingDto {
  /**
   * Bounds are checked in the service against the catalogue rather than declared here: each key
   * has its own range, and a single DTO cannot carry three of them.
   */
  @ApiProperty({ example: 0.7, description: 'Checked against the range declared for the key.' })
  @IsNumber({ maxDecimalPlaces: 4 })
  value: number;
}

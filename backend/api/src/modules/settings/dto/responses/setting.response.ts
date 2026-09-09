import { ApiProperty } from '@nestjs/swagger';

export class SettingResponse {
  @ApiProperty({ example: 'DECOMMISSION_COST_RATIO_CONSIDER' }) key: string;
  @ApiProperty({ example: 0.7 }) value: number;
  @ApiProperty({ example: 0.7, description: 'What the value falls back to with no override.' })
  default: number;

  @ApiProperty({ enum: ['RATIO', 'COUNT'] }) kind: 'RATIO' | 'COUNT';
  @ApiProperty() min: number;
  @ApiProperty() max: number;
  @ApiProperty() description: string;

  /** False when the value is still the shipped default — the Director has not touched it. */
  @ApiProperty() isOverridden: boolean;
}

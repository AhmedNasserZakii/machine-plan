import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Severity } from 'src/common/enums/operations.enum';

/**
 * The flat shape every lookup endpoint returns: `name` is already resolved for the requested
 * locale, so the client never sees a translations array (`02-database-localization-strategy.md`).
 */
export class LookupResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'POS_TERMINAL' }) code: string;
  @ApiProperty({ example: 'ماكينة نقاط بيع' }) name: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() sortOrder: number;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Only present with `?rawTranslations=true`, for admin editing screens.',
    example: { ar: { name: 'ماكينة نقاط بيع' }, en: { name: 'POS Terminal' } },
  })
  translations?: Record<string, { name: string; description?: string | null }>;
}

export class ViolationTypeResponse extends LookupResponse {
  @ApiProperty({ enum: Severity }) defaultSeverity: Severity;
}

export class MachineTypeResponse extends LookupResponse {
  @ApiProperty({ description: 'Machines of this type carry a SIM card; false for a PIN pad.' })
  requiresSim: boolean;
}

class MachineTypeRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;

  /** Carried on the model too, so a machine form knows whether to ask for a SIM serial. */
  @ApiProperty() requiresSim: boolean;
}

export class MachineModelResponse extends LookupResponse {
  @ApiProperty({ type: MachineTypeRefResponse }) machineType: MachineTypeRefResponse;
  @ApiProperty({ nullable: true }) manufacturer: string | null;
}

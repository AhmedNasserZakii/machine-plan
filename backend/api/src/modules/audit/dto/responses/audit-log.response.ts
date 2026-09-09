import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, AuditEntityType } from 'src/common/enums';

export class AuditLogResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() createdAt: string;
  @ApiProperty({ format: 'uuid', nullable: true }) userId: string | null;
  @ApiProperty({ enum: AuditAction }) action: AuditAction;
  @ApiProperty({ enum: AuditEntityType, nullable: true }) entityType: AuditEntityType | null;
  @ApiProperty({ format: 'uuid', nullable: true }) entityId: string | null;
  @ApiProperty({ type: Object, nullable: true }) before: object | null;
  @ApiProperty({ type: Object, nullable: true }) after: object | null;
  @ApiProperty({ nullable: true }) requestId: string | null;
  @ApiProperty({ nullable: true }) ipAddress: string | null;
  @ApiProperty({ nullable: true }) userAgent: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionResponse {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'machines.create' })
  code: string;

  @ApiProperty({ example: 'machines' })
  group: string;

  @ApiProperty({ example: 'إضافة ماكينة' })
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;
}

export class PermissionGroupResponse {
  @ApiProperty({ example: 'finance' })
  group: string;

  @ApiProperty({ example: 'المالية' })
  label: string;

  @ApiProperty({ type: [PermissionResponse] })
  permissions: PermissionResponse[];
}

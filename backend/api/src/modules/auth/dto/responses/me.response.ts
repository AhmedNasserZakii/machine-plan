import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeRoleResponse {
  @ApiProperty({ example: 'REPRESENTATIVE' })
  code: string;

  @ApiProperty({ example: 'مندوب', description: 'Localized to the request locale' })
  name: string;
}

export class MeBranchResponse {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'فرع الإسكندرية' })
  name: string;
}

export class MeResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phone: string;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiProperty({ type: MeRoleResponse })
  role: MeRoleResponse;

  @ApiPropertyOptional({ type: MeBranchResponse, nullable: true })
  branch: MeBranchResponse | null;

  @ApiProperty({
    type: [String],
    example: ['machines.read', 'transfers.confirm'],
    description: 'Effective permissions. The app drives all UI visibility from this list.',
  })
  permissions: string[];

  @ApiProperty()
  mustChangePassword: boolean;

  @ApiProperty()
  biometricEnabled: boolean;

  @ApiPropertyOptional({ nullable: true })
  signatureImageUrl: string | null;
}

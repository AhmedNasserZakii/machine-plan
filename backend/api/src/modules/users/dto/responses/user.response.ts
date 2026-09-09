import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionEffect } from 'src/common/enums';

export class UserRoleSummary {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'REPRESENTATIVE' })
  code: string;

  @ApiProperty({ example: 'مندوب' })
  displayName: string;
}

export class UserResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phone: string;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiProperty({ type: UserRoleSummary })
  role: UserRoleSummary;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  branchId: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  mustChangePassword: boolean;

  @ApiProperty()
  biometricEnabled: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastLoginAt: string | null;

  @ApiProperty()
  createdAt: string;
}

export class UserPermissionOverrideResponse {
  @ApiProperty({ example: 'finance.read' })
  code: string;

  @ApiProperty({ enum: PermissionEffect })
  effect: PermissionEffect;
}

export class UserPermissionsResponse {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ type: [String], description: 'Codes granted by the user role' })
  rolePermissions: string[];

  @ApiProperty({ type: [UserPermissionOverrideResponse] })
  overrides: UserPermissionOverrideResponse[];

  @ApiProperty({
    type: [String],
    description: '(role ∪ ALLOW overrides) \\ DENY overrides — what the guards actually check',
  })
  effectivePermissions: string[];
}

export class ResetPasswordResponse {
  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Returned only when the server generated the password. Shown once.',
  })
  temporaryPassword: string | null;
}

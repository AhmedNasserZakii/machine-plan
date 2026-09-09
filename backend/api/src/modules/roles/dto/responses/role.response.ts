import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';

export class RoleResponse {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'BRANCH_SUPERVISOR' })
  code: string;

  @ApiProperty({ example: 'مشرف فرع' })
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ description: 'System roles cannot be deleted, but their permissions can change' })
  isSystem: boolean;

  @ApiProperty({ type: [String], example: ['machines.read', 'transfers.create'] })
  permissions: string[];

  @ApiProperty()
  permissionCount: number;

  @ApiPropertyOptional({
    description: 'All locales at once. Present only with ?raw_translations=true.',
  })
  translations?: Partial<Record<Locale, { displayName: string; description: string | null }>>;
}

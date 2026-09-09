import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsEgyptianMobile } from 'src/common/validators/is-egyptian-mobile.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'محمود عبد الله' })
  @IsString()
  @Length(3, 150)
  fullName: string;

  @ApiProperty({ example: '01001234567' })
  @IsEgyptianMobile()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for branch-scoped roles' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ minLength: 8, description: 'Temporary — the user must change it on first login' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

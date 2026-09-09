import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';
import { IsEgyptianMobile } from 'src/common/validators/is-egyptian-mobile.validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 150)
  fullName?: string;

  @ApiPropertyOptional({ example: '01001234567' })
  @IsOptional()
  @IsEgyptianMobile()
  phone?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ResetPasswordDto {
  @ApiPropertyOptional({
    minLength: 8,
    description: 'Omit to have the server generate one and return it once',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}

export class SetUserPermissionsDto {
  @ApiPropertyOptional({ type: [String], description: 'Permission codes to explicitly ALLOW' })
  @IsOptional()
  @IsString({ each: true })
  allow?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Permission codes to explicitly DENY' })
  @IsOptional()
  @IsString({ each: true })
  deny?: string[];
}

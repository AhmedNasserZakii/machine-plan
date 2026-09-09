import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({ minLength: 8, description: 'Must differ from the current password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refresh token issued by /auth/login or a previous /auth/refresh',
  })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  refreshToken: string;
}

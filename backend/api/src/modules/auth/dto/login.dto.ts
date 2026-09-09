import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { DevicePlatform } from 'src/modules/users/entities/user-device.entity';

export class LoginDto {
  @ApiProperty({
    example: '01001234567',
    description: 'Egyptian phone number — the login identifier',
  })
  @IsString()
  @Length(10, 20)
  phone: string;

  @ApiProperty({ minLength: 8, example: 'S3curePass' })
  @IsString()
  @MinLength(8)
  // Caps the bytes fed into argon2 on the unauthenticated path — a multi-kilobyte
  // password is a cheap CPU-amplification lever otherwise.
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    description: 'Stable client-generated device id; ties the session to a device',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'Samsung SM-A536E' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceModel?: string;

  @ApiPropertyOptional({ enum: DevicePlatform })
  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DevicePlatform } from 'src/modules/users/entities/user-device.entity';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Stable client-generated device id' })
  @IsString()
  @MaxLength(120)
  deviceId: string;

  @ApiPropertyOptional({ description: 'FCM registration token for push delivery' })
  @IsOptional()
  @IsString()
  pushToken?: string;

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

export class EnrollBiometricDto {
  @ApiProperty({ description: 'Must be a device already registered to the caller' })
  @IsString()
  @MaxLength(120)
  deviceId: string;

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

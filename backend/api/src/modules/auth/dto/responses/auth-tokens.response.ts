import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: '30m', description: 'Access token lifetime' })
  expiresIn: string;

  @ApiProperty({ description: 'Absolute expiry of the refresh token' })
  refreshExpiresAt: string;

  @ApiProperty({
    description: 'When true the client must call /auth/change-password before doing anything else',
  })
  mustChangePassword: boolean;
}

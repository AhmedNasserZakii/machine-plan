import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshTtl: string;
  loginMaxAttempts: number;
  loginLockMinutes: number;
}

// Note: there is deliberately no refresh secret — refresh tokens are opaque random
// values stored as digests, not JWTs, so no signing key is involved.
export const jwtConfig = registerAs('jwt', (): JwtConfig => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '30m',
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  loginLockMinutes: Number(process.env.LOGIN_LOCK_MINUTES ?? 15),
}));

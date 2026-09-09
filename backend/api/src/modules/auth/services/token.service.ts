import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AppException } from 'src/common/errors';
import { sha256 } from 'src/common/utils/hash.util';
import { JwtConfig } from 'src/config';
import { RefreshToken, RevokeReason } from '../entities/refresh-token.entity';

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: string;
  branchId: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: Date;
}

type RevokeReasonValue = (typeof RevokeReason)[keyof typeof RevokeReason];

@Injectable()
export class TokenService {
  private readonly config: JwtConfig;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<JwtConfig>('jwt');
  }

  /** Issues an access token plus a fresh refresh token, persisting only the token's digest. */
  async issue(
    payload: AccessTokenPayload,
    deviceId: string | null,
    replacesTokenId: string | null = null,
  ): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      algorithm: 'HS256',
      // Passed as seconds so the configured `30m` string is validated by our own parser
      // rather than by jsonwebtoken's narrower literal type.
      expiresIn: Math.floor(parseDuration(this.config.accessTtl) / 1000),
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + parseDuration(this.config.refreshTtl));

    const record = await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: payload.sub,
        tokenHash: sha256(refreshToken),
        deviceId,
        expiresAt,
        createdBy: payload.sub,
      }),
    );

    if (replacesTokenId) {
      await this.refreshTokens.update(replacesTokenId, { replacedById: record.id });
    }

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: this.config.accessTtl,
      refreshExpiresAt: expiresAt,
    };
  }

  /**
   * Validates a presented refresh token.
   *
   * Presenting an already-rotated token means the token was captured after use, so the
   * entire device chain is revoked rather than just this one row (theft detection, `04`).
   */
  async consumeForRotation(presentedToken: string): Promise<RefreshToken> {
    const tokenHash = sha256(presentedToken);
    const record = await this.refreshTokens.findOne({ where: { tokenHash } });

    if (!record) {
      throw new AppException(ErrorCode.TOKEN_REVOKED);
    }

    if (record.revokedAt !== null) {
      await this.revokeAllForUser(record.userId, RevokeReason.REUSE_DETECTED);
      throw new AppException(ErrorCode.TOKEN_REVOKED);
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AppException(ErrorCode.TOKEN_EXPIRED);
    }

    // Conditional on `revokedAt IS NULL` so two concurrent presentations of the same
    // token cannot both pass the check above and both receive fresh pairs — the loser
    // of the race is treated exactly like a replayed token.
    const revoked = await this.refreshTokens.update(
      { id: record.id, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: RevokeReason.ROTATED },
    );

    if (!revoked.affected) {
      await this.revokeAllForUser(record.userId, RevokeReason.REUSE_DETECTED);
      throw new AppException(ErrorCode.TOKEN_REVOKED);
    }

    return record;
  }

  async revokeByToken(presentedToken: string, reason: RevokeReasonValue): Promise<void> {
    await this.refreshTokens.update(
      { tokenHash: sha256(presentedToken), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  async revokeAllForUser(userId: string, reason: RevokeReasonValue): Promise<void> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /** Housekeeping — removes rows that can no longer be presented. */
  async purgeExpired(): Promise<number> {
    const result = await this.refreshTokens.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }
}

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses a `30m` / `30d` style duration into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: "${value}" (expected e.g. 30m, 30d)`);
  }
  return Number(match[1]) * DURATION_UNITS[match[2]];
}

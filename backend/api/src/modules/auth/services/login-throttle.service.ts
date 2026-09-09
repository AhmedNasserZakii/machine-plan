import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheKeys, CacheService } from 'src/common/cache';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AppException } from 'src/common/errors';
import { JwtConfig } from 'src/config';

/**
 * Login lockout tracked per phone **and** IP, so one attacker cannot lock a legitimate
 * user out from a different network (`04-auth-and-permissions.md`).
 */
@Injectable()
export class LoginThrottleService {
  private readonly maxAttempts: number;
  private readonly lockMinutes: number;

  constructor(
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    const jwt = config.getOrThrow<JwtConfig>('jwt');
    this.maxAttempts = jwt.loginMaxAttempts;
    this.lockMinutes = jwt.loginLockMinutes;
  }

  /** Throws `ACCOUNT_LOCKED` when the caller is currently locked out. */
  async assertNotLocked(phone: string, ip: string): Promise<void> {
    const lockKey = CacheKeys.loginLock(phone, ip);
    const locked = await this.cache.getJson<boolean>(lockKey);
    if (!locked) return;

    const ttlSeconds = await this.cache.ttl(lockKey);
    const minutes = ttlSeconds > 0 ? Math.ceil(ttlSeconds / 60) : this.lockMinutes;
    throw new AppException(ErrorCode.ACCOUNT_LOCKED, { params: { minutes } });
  }

  /** Records a failed attempt and engages the lock once the threshold is reached. */
  async recordFailure(phone: string, ip: string): Promise<void> {
    const lockSeconds = this.lockMinutes * 60;
    const attempts = await this.cache.incr(CacheKeys.loginAttempts(phone, ip), lockSeconds);

    if (attempts >= this.maxAttempts) {
      await this.cache.setJson(CacheKeys.loginLock(phone, ip), true, lockSeconds);
      await this.cache.del(CacheKeys.loginAttempts(phone, ip));
      throw new AppException(ErrorCode.ACCOUNT_LOCKED, { params: { minutes: this.lockMinutes } });
    }
  }

  async reset(phone: string, ip: string): Promise<void> {
    await this.cache.del(CacheKeys.loginAttempts(phone, ip), CacheKeys.loginLock(phone, ip));
  }

  /**
   * The change-password endpoint verifies the current password, so without its own
   * counter a stolen (short-lived) access token could be escalated into permanent
   * control by brute-forcing `currentPassword`. Keyed by user id: the account is the
   * asset under attack regardless of source IP.
   */
  async assertPasswordChangeNotLocked(userId: string): Promise<void> {
    const lockKey = CacheKeys.passwordChangeLock(userId);
    const locked = await this.cache.getJson<boolean>(lockKey);
    if (!locked) return;

    const ttlSeconds = await this.cache.ttl(lockKey);
    const minutes = ttlSeconds > 0 ? Math.ceil(ttlSeconds / 60) : this.lockMinutes;
    throw new AppException(ErrorCode.ACCOUNT_LOCKED, { params: { minutes } });
  }

  async recordPasswordChangeFailure(userId: string): Promise<void> {
    const lockSeconds = this.lockMinutes * 60;
    const attempts = await this.cache.incr(CacheKeys.passwordChangeAttempts(userId), lockSeconds);

    if (attempts >= this.maxAttempts) {
      await this.cache.setJson(CacheKeys.passwordChangeLock(userId), true, lockSeconds);
      await this.cache.del(CacheKeys.passwordChangeAttempts(userId));
      throw new AppException(ErrorCode.ACCOUNT_LOCKED, { params: { minutes: this.lockMinutes } });
    }
  }

  async resetPasswordChange(userId: string): Promise<void> {
    await this.cache.del(
      CacheKeys.passwordChangeAttempts(userId),
      CacheKeys.passwordChangeLock(userId),
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { DEFAULT_LOCALE, Locale } from 'src/common/constants/locales';
import { AuditAction, AuditEntityType } from 'src/common/enums/audit.enum';
import { AppException } from 'src/common/errors';
import { AuthUser } from 'src/common/types/request.types';
import { normalizePhone } from 'src/common/utils/phone.util';
import { resolveTranslatedField } from 'src/common/utils/resolve-translation.util';
import { PermissionsService } from 'src/modules/roles/permissions.service';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { UserDevice } from 'src/modules/users/entities/user-device.entity';
import { RevokeReason } from './entities/refresh-token.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { EnrollBiometricDto, RegisterDeviceDto } from './dto/register-device.dto';
import { AuthTokensResponse } from './dto/responses/auth-tokens.response';
import { MeBranchResponse, MeResponse } from './dto/responses/me.response';
import { LoginThrottleService } from './services/login-throttle.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

export interface LoginContext {
  ip: string;
  /** Falls back to the `X-Device-Id` header when the body omits it. */
  deviceId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserDevice) private readonly devices: Repository<UserDevice>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly throttle: LoginThrottleService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, context: LoginContext): Promise<AuthTokensResponse> {
    const phone = normalizePhone(dto.phone);
    await this.throttle.assertNotLocked(phone, context.ip);

    const user = await this.users.findOne({
      where: { phone },
      relations: { role: true },
      select: {
        id: true,
        fullName: true,
        phone: true,
        passwordHash: true,
        roleId: true,
        branchId: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    // Verify a dummy hash when the user is unknown so the response time does not
    // reveal whether a phone number is registered.
    const passwordMatches = user
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : await this.passwords.verify(DUMMY_HASH, dto.password);

    if (!user || !passwordMatches) {
      await this.throttle.recordFailure(phone, context.ip);
      await this.audit.record({
        userId: user?.id ?? null,
        action: AuditAction.LOGIN_FAILED,
        entityType: AuditEntityType.AUTH,
        entityId: user?.id ?? null,
        after: { phone, reason: 'INVALID_CREDENTIALS' },
      });
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      await this.audit.record({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: AuditEntityType.AUTH,
        entityId: user.id,
        after: { phone, reason: 'ACCOUNT_INACTIVE' },
      });
      throw new AppException(ErrorCode.ACCOUNT_INACTIVE);
    }

    await this.throttle.reset(phone, context.ip);

    const deviceId = dto.deviceId ?? context.deviceId ?? null;
    if (deviceId) {
      await this.touchDevice(user.id, {
        deviceId,
        deviceModel: dto.deviceModel,
        platform: dto.platform,
      });
    }

    const issued = await this.tokens.issue(
      {
        sub: user.id,
        phone: user.phone,
        role: user.role.code,
        branchId: user.branchId,
      },
      deviceId,
    );

    await this.users.update(user.id, { lastLoginAt: new Date() });

    await this.audit.record({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      after: { deviceId },
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      expiresIn: issued.accessExpiresIn,
      refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
      mustChangePassword: user.mustChangePassword,
    };
  }

  /** Rotates a refresh token: the presented token is revoked and a new pair is issued. */
  async refresh(presentedToken: string): Promise<AuthTokensResponse> {
    const record = await this.tokens.consumeForRotation(presentedToken);

    const user = await this.users.findOne({
      where: { id: record.userId },
      relations: { role: true },
    });

    if (!user) {
      throw new AppException(ErrorCode.TOKEN_REVOKED);
    }

    if (!user.isActive) {
      await this.tokens.revokeAllForUser(user.id, RevokeReason.USER_DEACTIVATED);
      throw new AppException(ErrorCode.ACCOUNT_INACTIVE);
    }

    const issued = await this.tokens.issue(
      { sub: user.id, phone: user.phone, role: user.role.code, branchId: user.branchId },
      record.deviceId,
      record.id,
    );

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      expiresIn: issued.accessExpiresIn,
      refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
      mustChangePassword: user.mustChangePassword,
    };
  }

  async logout(userId: string, presentedToken: string): Promise<{ revoked: true }> {
    await this.tokens.revokeByToken(presentedToken, RevokeReason.LOGOUT);
    await this.audit.record({
      userId,
      action: AuditAction.LOGOUT,
      entityType: AuditEntityType.AUTH,
      entityId: userId,
    });
    return { revoked: true };
  }

  /**
   * Changing the password revokes every other session, so a stolen refresh token cannot
   * outlive the password it was obtained with.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ changed: true }> {
    if (dto.currentPassword === dto.newPassword) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'newPassword', constraint: 'must be different from the current password' },
        ],
      });
    }

    // Throttled like login: a stolen access token must not be convertible into permanent
    // control by brute-forcing the current password.
    await this.throttle.assertPasswordChangeNotLocked(userId);

    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user || !(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      await this.throttle.recordPasswordChangeFailure(userId);
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }

    await this.throttle.resetPasswordChange(userId);

    await this.users.update(userId, {
      passwordHash: await this.passwords.hash(dto.newPassword),
      mustChangePassword: false,
      updatedBy: userId,
    });

    await this.tokens.revokeAllForUser(userId, RevokeReason.PASSWORD_CHANGED);

    await this.audit.record({
      userId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: AuditEntityType.AUTH,
      entityId: userId,
    });

    return { changed: true };
  }

  async me(userId: string, locale: Locale = DEFAULT_LOCALE): Promise<MeResponse> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { role: { translations: true } },
    });

    if (!user) {
      throw AppException.notFound();
    }

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: {
        code: user.role.code,
        name: String(
          resolveTranslatedField(user.role.translations, locale, 'displayName', user.role.code),
        ),
      },
      branch: await this.resolveBranch(user.branchId),
      permissions: await this.permissions.getEffectivePermissions(user.id),
      mustChangePassword: user.mustChangePassword,
      biometricEnabled: user.biometricEnabled,
      signatureImageUrl: user.signatureImageUrl,
    };
  }

  /**
   * Company-level users have no branch. A branch name is operational data and not localized
   * (`06-feature-branches-warehouses.md` rule 4), so there is nothing to resolve per locale.
   */
  private async resolveBranch(branchId: string | null): Promise<MeBranchResponse | null> {
    if (!branchId) {
      return null;
    }

    const branch = await this.branches.findOne({
      where: { id: branchId },
      select: { id: true, name: true },
    });

    return branch ? { id: branch.id, name: branch.name } : null;
  }

  /** Registers or updates a device and its push token. */
  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<UserDevice> {
    return this.touchDevice(userId, dto);
  }

  /**
   * Marks a device as trusted for biometric confirmation.
   *
   * The server cannot verify a fingerprint. What enrollment buys is the ability to later
   * assert "this signature came from a device this user had already registered" (`04`).
   */
  async enrollBiometric(userId: string, dto: EnrollBiometricDto): Promise<{ enrolled: true }> {
    const now = new Date();

    await this.touchDevice(userId, dto);
    await this.devices.update(
      { userId, deviceId: dto.deviceId },
      { biometricEnrolled: true, biometricEnrolledAt: now, updatedBy: userId },
    );
    await this.users.update(userId, { biometricEnabled: true, updatedBy: userId });

    this.logger.log({ userId, deviceId: dto.deviceId }, 'Biometric device enrolled');
    await this.audit.record({
      userId,
      action: AuditAction.BIOMETRIC_ENROLLED,
      entityType: AuditEntityType.AUTH,
      entityId: userId,
      after: { deviceId: dto.deviceId },
    });
    return { enrolled: true };
  }

  /** True when the device is registered to the user and enrolled for biometrics. */
  async isDeviceEnrolled(userId: string, deviceId: string): Promise<boolean> {
    const count = await this.devices.count({
      where: { userId, deviceId, biometricEnrolled: true, isActive: true },
    });
    return count > 0;
  }

  async removeDevice(userId: string, deviceId: string): Promise<{ removed: true }> {
    await this.devices.update({ userId, deviceId }, { isActive: false, pushToken: null });
    await this.tokens.revokeAllForUser(userId, RevokeReason.LOGOUT);
    return { removed: true };
  }

  /** Upserts a device row and refreshes `last_seen_at`. */
  private async touchDevice(
    userId: string,
    dto: {
      deviceId: string;
      deviceModel?: string;
      platform?: UserDevice['platform'];
      pushToken?: string;
    },
  ): Promise<UserDevice> {
    const existing = await this.devices.findOne({ where: { userId, deviceId: dto.deviceId } });
    const now = new Date();

    if (existing) {
      await this.devices.update(existing.id, {
        deviceModel: dto.deviceModel ?? existing.deviceModel,
        platform: dto.platform ?? existing.platform,
        pushToken: dto.pushToken ?? existing.pushToken,
        lastSeenAt: now,
        isActive: true,
        updatedBy: userId,
      });
      return { ...existing, lastSeenAt: now };
    }

    return this.devices.save(
      this.devices.create({
        userId,
        deviceId: dto.deviceId,
        deviceModel: dto.deviceModel ?? null,
        platform: dto.platform ?? null,
        pushToken: dto.pushToken ?? null,
        lastSeenAt: now,
        createdBy: userId,
      }),
    );
  }

  /** Builds the principal attached to each authenticated request. */
  async buildAuthUser(userId: string): Promise<AuthUser | null> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      roleId: user.roleId,
      roleCode: user.role.code,
      branchId: user.branchId,
      mustChangePassword: user.mustChangePassword,
      permissions: await this.permissions.getEffectivePermissions(user.id),
    };
  }
}

/**
 * A real argon2id digest of a random string, used only to keep the failure path's timing
 * comparable to the success path.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHlzYWx0eXNhbHR5c2E$T4YKPuAvBIQBrYRz1w7wY0PLZmKpWkFqCn0Yw6l7cVo';

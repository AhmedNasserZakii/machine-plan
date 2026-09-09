import { Locale } from 'src/common/constants/locales';
import { resolveTranslatedField } from 'src/common/utils/resolve-translation.util';
import { UserResponse } from '../dto/responses/user.response';
import { User } from '../entities/user.entity';

export function toUserResponse(user: User, locale: Locale): UserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: {
      id: user.roleId,
      code: user.role.code,
      displayName: String(
        resolveTranslatedField(user.role.translations, locale, 'displayName', user.role.code),
      ),
    },
    branchId: user.branchId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    biometricEnabled: user.biometricEnabled,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

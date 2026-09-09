import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';

/**
 * Lets a route run even while the caller still has `must_change_password = true`.
 * Only the handful of endpoints needed to complete the change should carry this.
 */
export const AllowPasswordChangePending = (): CustomDecorator<string> =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);

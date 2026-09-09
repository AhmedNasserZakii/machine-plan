import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const SKIP_VERSION_CHECK_KEY = 'skipVersionCheck';

/**
 * Opts a route out of `ClientVersionGuard` (`4.3`). Deliberately separate from `@Public()`:
 * unlike authentication, the forced-upgrade check is meant to apply to `/auth/login` and
 * `/auth/refresh` too — that is the one place an out-of-date app is guaranteed to call before
 * doing anything else, so it is where the blocking upgrade dialog actually needs to fire.
 */
export const SkipVersionCheck = (): CustomDecorator<string> =>
  SetMetadata(SKIP_VERSION_CHECK_KEY, true);

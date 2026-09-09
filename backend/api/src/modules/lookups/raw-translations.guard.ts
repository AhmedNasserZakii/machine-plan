import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AppException } from 'src/common/errors';
import { RequestContext } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';

/**
 * `?rawTranslations=true` returns the full per-locale map instead of a resolved string. Ordinary
 * clients only ever need the resolved name, and `02-database-localization-strategy.md` gates the
 * admin shape, so the flag needs the same permission as editing the lookups.
 *
 * Runs as a guard rather than a check inside each handler: the flag applies to every lookup list
 * endpoint, and guards see the raw query before validation.
 */
@Injectable()
export class RawTranslationsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestContext>();

    if (request.query.rawTranslations !== 'true') return true;
    if (request.user?.permissions.includes(Perm.SETTINGS_MANAGE)) return true;

    throw AppException.forbidden(ErrorCode.INSUFFICIENT_PERMISSIONS);
  }
}

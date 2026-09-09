import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../constants/error-codes';
import { AppConfig } from '../../config';
import { SKIP_VERSION_CHECK_KEY } from '../decorators/skip-version-check.decorator';
import { AppException } from '../errors';
import { RequestContext } from '../types/request.types';
import { isVersionBelow } from '../utils/version.util';

/**
 * Forced upgrades (`4.3`, plan `22`): rejects a request carrying an `X-Client-Version` below
 * `MIN_CLIENT_VERSION` with `426 CLIENT_UPGRADE_REQUIRED` before any other guard runs — a stale
 * app should see the blocking upgrade dialog even on `/auth/login`, which is the one request an
 * offline-for-months client is guaranteed to make before anything else.
 *
 * The header is *recommended*, not required (plan `22`): a caller that omits it, or sends
 * something that doesn't parse as a dotted version, is let through unchanged rather than
 * refused — this is a product nudge to upgrade, not an authentication or security control.
 */
@Injectable()
export class ClientVersionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_VERSION_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const app = this.config.getOrThrow<AppConfig>('app');
    if (!app.minClientVersion) return true;

    const request = context.switchToHttp().getRequest<RequestContext>();
    const clientVersion = request.headers['x-client-version'];
    if (typeof clientVersion !== 'string' || clientVersion.length === 0) return true;

    if (isVersionBelow(clientVersion, app.minClientVersion)) {
      throw new AppException(ErrorCode.CLIENT_UPGRADE_REQUIRED, {
        params: { minVersion: app.minClientVersion },
        extra: { minVersion: app.minClientVersion },
      });
    }

    return true;
  }
}

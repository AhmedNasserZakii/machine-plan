import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AppException } from 'src/common/errors';
import { AuthUser } from 'src/common/types/request.types';
import { JwtConfig } from 'src/config';
import { AuthService } from '../auth.service';
import { AccessTokenPayload } from '../services/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<JwtConfig>('jwt').accessSecret,
      // Pinned so the verifier can never be talked into a different HMAC variant than
      // the one we sign with.
      algorithms: ['HS256'],
    });
  }

  /**
   * Rebuilds the principal from the database on every request rather than trusting the
   * token's claims. This is what makes a deactivation or a permission change take effect
   * immediately instead of at the next token refresh.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.auth.buildAuthUser(payload.sub);

    if (!user) {
      throw new AppException(ErrorCode.ACCOUNT_INACTIVE);
    }

    return user;
  }
}

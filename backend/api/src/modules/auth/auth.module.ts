import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { UserDevice } from 'src/modules/users/entities/user-device.entity';
import { RolesModule } from 'src/modules/roles/roles.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordService } from './services/password.service';
import { LoginThrottleService } from './services/login-throttle.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // `Branch` is a repository-only import so `/auth/me` can name the caller's branch
    // without depending on OrganizationModule, which itself needs auth guards.
    TypeOrmModule.forFeature([User, UserDevice, RefreshToken, Branch]),
    PassportModule,
    // Secrets are passed per-signature in TokenService, because access and refresh
    // tokens use different keys.
    JwtModule.register({}),
    RolesModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, LoginThrottleService, JwtStrategy],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}

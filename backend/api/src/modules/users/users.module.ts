import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/modules/auth/auth.module';
import { Permission } from 'src/modules/roles/entities/permission.entity';
import { Role } from 'src/modules/roles/entities/role.entity';
import { RolesModule } from 'src/modules/roles/roles.module';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { CUSTODY_PORT, MachineCustodyAdapter } from './custody.port';
import { User } from './entities/user.entity';
import { UserDevice } from './entities/user-device.entity';
import { UserPermissionOverride } from './entities/user-permission-override.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserCustodyService } from './user-custody.service';

@Module({
  imports: [
    // `Branch` is a repository import so a user's `branchId` can be validated without
    // depending on OrganizationModule, which itself needs the `User` repository.
    TypeOrmModule.forFeature([
      User,
      UserDevice,
      UserPermissionOverride,
      Role,
      Permission,
      Branch,
      Machine,
    ]),
    RolesModule,
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserCustodyService,
    MachineCustodyAdapter,
    { provide: CUSTODY_PORT, useExisting: MachineCustodyAdapter },
  ],
  exports: [UsersService],
})
export class UsersModule {}

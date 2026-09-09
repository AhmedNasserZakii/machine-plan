import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPermissionOverride } from 'src/modules/users/entities/user-permission-override.entity';
import { Permission } from './entities/permission.entity';
import { PermissionTranslation } from './entities/permission-translation.entity';
import { Role } from './entities/role.entity';
import { RoleTranslation } from './entities/role-translation.entity';
import { PermissionsService } from './permissions.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      RoleTranslation,
      Permission,
      PermissionTranslation,
      UserPermissionOverride,
    ]),
  ],
  controllers: [RolesController],
  providers: [RolesService, PermissionsService],
  exports: [PermissionsService, RolesService],
})
export class RolesModule {}

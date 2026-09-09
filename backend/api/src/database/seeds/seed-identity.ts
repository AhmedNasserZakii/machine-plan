import { DataSource, In } from 'typeorm';
import * as argon2 from 'argon2';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { normalizePhone } from 'src/common/utils/phone.util';
import { Permission } from 'src/modules/roles/entities/permission.entity';
import { PermissionTranslation } from 'src/modules/roles/entities/permission-translation.entity';
import { Role } from 'src/modules/roles/entities/role.entity';
import { RoleTranslation } from 'src/modules/roles/entities/role-translation.entity';
import { PERMISSION_CATALOGUE, ROLE_CATALOGUE } from 'src/modules/roles/permissions.catalogue';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { SeedLogger } from './seed-logger';

/**
 * Seeds the permission catalogue, the five system roles with their default grants, and one
 * Director account. Idempotent: re-running updates translations and grants in place rather
 * than duplicating rows, so it is safe to run on every deploy.
 */
export async function seedIdentity(dataSource: DataSource, log: SeedLogger): Promise<void> {
  await seedPermissions(dataSource, log);
  await seedRoles(dataSource, log);
  await seedDirector(dataSource, log);
}

async function seedPermissions(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const permissions = dataSource.getRepository(Permission);
  const translations = dataSource.getRepository(PermissionTranslation);

  let created = 0;
  let updated = 0;

  for (const definition of PERMISSION_CATALOGUE) {
    let permission = await permissions.findOne({ where: { code: definition.code } });

    if (permission) {
      await permissions.update(permission.id, {
        group: definition.group,
        sortOrder: definition.sortOrder,
      });
      updated += 1;
    } else {
      permission = await permissions.save(
        permissions.create({
          code: definition.code,
          group: definition.group,
          sortOrder: definition.sortOrder,
        }),
      );
      created += 1;
    }

    for (const locale of SUPPORTED_LOCALES) {
      const payload = definition.translations[locale];
      if (!payload) continue;

      const existing = await translations.findOne({
        where: { permissionId: permission.id, locale },
      });

      if (existing) {
        await translations.update(existing.id, {
          displayName: payload.displayName,
          description: payload.description ?? null,
        });
      } else {
        await translations.save(
          translations.create({
            permissionId: permission.id,
            locale,
            displayName: payload.displayName,
            description: payload.description ?? null,
          }),
        );
      }
    }
  }

  log.step(
    `permissions: ${created} created, ${updated} updated (${PERMISSION_CATALOGUE.length} total)`,
  );
}

async function seedRoles(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const roles = dataSource.getRepository(Role);
  const translations = dataSource.getRepository(RoleTranslation);
  const permissions = dataSource.getRepository(Permission);

  for (const definition of ROLE_CATALOGUE) {
    let role = await roles.findOne({
      where: { code: definition.code },
      relations: { permissions: true },
    });

    if (!role) {
      role = await roles.save(roles.create({ code: definition.code, isSystem: true }));
    } else if (!role.isSystem) {
      await roles.update(role.id, { isSystem: true });
    }

    for (const locale of SUPPORTED_LOCALES) {
      const payload = definition.translations[locale];
      if (!payload) continue;

      const existing = await translations.findOne({ where: { roleId: role.id, locale } });
      if (existing) {
        await translations.update(existing.id, {
          displayName: payload.displayName,
          description: payload.description,
        });
      } else {
        await translations.save(
          translations.create({
            roleId: role.id,
            locale,
            displayName: payload.displayName,
            description: payload.description,
          }),
        );
      }
    }

    const granted = await permissions.find({ where: { code: In([...definition.permissions]) } });
    role.permissions = granted;
    await roles.save(role);

    log.step(`role ${definition.code}: ${granted.length} permissions`);
  }
}

/**
 * Creates the bootstrap Director. The password comes from `SEED_DIRECTOR_PASSWORD`;
 * `must_change_password` is left true so it cannot survive first login.
 */
async function seedDirector(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const users = dataSource.getRepository(User);
  const roles = dataSource.getRepository(Role);

  const directorRole = await roles.findOneOrFail({ where: { code: SystemRole.DIRECTOR } });

  const phone = normalizePhone(process.env.SEED_DIRECTOR_PHONE ?? '01000000000');
  const existing = await users.findOne({ where: { phone } });

  if (existing) {
    log.step(`director: already present (${phone})`);
    return;
  }

  const password = process.env.SEED_DIRECTOR_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error(
      'SEED_DIRECTOR_PASSWORD must be set to at least 8 characters to seed the Director account',
    );
  }

  await users.save(
    users.create({
      fullName: process.env.SEED_DIRECTOR_NAME ?? 'مدير النظام',
      phone,
      email: process.env.SEED_DIRECTOR_EMAIL ?? null,
      passwordHash: await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
      roleId: directorRole.id,
      branchId: null,
      isActive: true,
      mustChangePassword: true,
    }),
  );

  log.step(`director: created (${phone}) — must change password on first login`);
}

import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { DataSource, EntityManager } from 'typeorm';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { BudgetPeriodType, FinanceKind } from 'src/common/enums/finance.enum';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { normalizePhone } from 'src/common/utils/phone.util';
import { buildPath } from 'src/modules/finance/category-path';
import { Budget } from 'src/modules/finance/entities/budget.entity';
import { FinanceCategory } from 'src/modules/finance/entities/finance-category.entity';
import { FinanceCategoryTranslation } from 'src/modules/finance/entities/finance-category-translation.entity';
import { Supplier } from 'src/modules/finance/entities/supplier.entity';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MachineModelTranslation } from 'src/modules/lookups/entities/machine-model-translation.entity';
import { MachineType } from 'src/modules/lookups/entities/machine-type.entity';
import { Battery } from 'src/modules/machines/entities/battery.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Merchant } from 'src/modules/merchants/entities/merchant.entity';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { Role, SystemRole } from 'src/modules/roles/entities/role.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { DEV_PASSWORD } from './seed-dev';
import { SeedLogger } from './seed-logger';

/**
 * How many rows to create per paginated collection. Default API limit is 20, so
 * 55 forces three pages on every list the mobile app still walks or pages.
 */
export const PAGINATION_SEED_COUNT = 55;

const PREFIX = 'PAGE';

/**
 * Bulk development data for exercising pagination on device / Maestro.
 * Idempotent by `PAGE_*` codes and serial prefixes. Requires `seed:dev` first
 * (needs a CAIRO branch + representative). Never run in production.
 */
export async function seedPagination(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const cairo = await dataSource.getRepository(Branch).findOne({ where: { code: 'CAIRO' } });
  if (!cairo) {
    throw new Error('seedPagination needs seed:dev first (missing CAIRO branch)');
  }

  const representative = await dataSource.getRepository(User).findOne({
    where: { phone: normalizePhone('01000000003') },
  });
  if (!representative) {
    throw new Error('seedPagination needs seed:dev first (missing Cairo representative)');
  }

  const types = await dataSource.getRepository(MachineType).find({ order: { code: 'ASC' } });
  if (types.length === 0) {
    throw new Error('seedPagination needs seeded machine types');
  }

  await seedBranches(dataSource, log);
  await seedSuppliers(dataSource, log);
  await seedMachineModels(dataSource, log, types[0].id);
  await seedMachines(dataSource, log);
  await seedMerchants(dataSource, log, cairo.id, representative.id);
  await seedBudgets(dataSource, log);
  await seedSupervisors(dataSource, log, cairo.id);

  log.step(
    `pagination seed ready — ${PAGINATION_SEED_COUNT} rows per collection ` +
      `(default limit 20 ⇒ at least 3 pages)`,
  );
}

async function seedBranches(dataSource: DataSource, log: SeedLogger): Promise<void> {
  let created = 0;
  for (let index = 0; index < PAGINATION_SEED_COUNT; index += 1) {
    const code = `${PREFIX}_BR_${String(index).padStart(3, '0')}`;
    if (await dataSource.getRepository(Branch).exist({ where: { code } })) continue;

    await dataSource.transaction(async (manager: EntityManager) => {
      const branch = await manager.getRepository(Branch).save({
        code,
        name: `فرع صفحة ${index}`,
        address: null,
        phone: null,
        isActive: true,
      });
      await manager.getRepository(Warehouse).save({
        branchId: branch.id,
        type: WarehouseType.BRANCH,
        name: `مخزن صفحة ${index}`,
        isActive: true,
      });
    });
    created += 1;
  }
  log.step(`pagination branches: ${created} created`);
}

async function seedSuppliers(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const repo = dataSource.getRepository(Supplier);
  const existing = await repo
    .createQueryBuilder('s')
    .where('s.name LIKE :prefix', { prefix: 'مورد صفحة %' })
    .getCount();
  if (existing >= PAGINATION_SEED_COUNT) {
    log.step('pagination suppliers: already present');
    return;
  }

  const rows = Array.from({ length: PAGINATION_SEED_COUNT - existing }, (_, offset) => {
    const index = existing + offset;
    return repo.create({
      name: `مورد صفحة ${index}`,
      phone: `022${String(2000000 + index)}`,
      notes: null,
      isActive: true,
    });
  });
  await repo.save(rows);
  log.step(`pagination suppliers: ${rows.length} created`);
}

async function seedMachineModels(
  dataSource: DataSource,
  log: SeedLogger,
  machineTypeId: string,
): Promise<void> {
  let created = 0;
  for (let index = 0; index < PAGINATION_SEED_COUNT; index += 1) {
    const code = `${PREFIX}_MDL_${String(index).padStart(3, '0')}`;
    if (await dataSource.getRepository(MachineModel).exist({ where: { code } })) continue;

    await dataSource.transaction(async (manager: EntityManager) => {
      const model = await manager.getRepository(MachineModel).save({
        code,
        machineTypeId,
        manufacturer: 'PageSeed',
        isActive: true,
        sortOrder: index,
      });
      await manager.getRepository(MachineModelTranslation).save([
        {
          machineModelId: model.id,
          locale: 'ar',
          name: `موديل صفحة ${index}`,
          description: null,
        },
        {
          machineModelId: model.id,
          locale: 'en',
          name: `Page model ${index}`,
          description: null,
        },
      ]);
    });
    created += 1;
  }
  log.step(`pagination machine models: ${created} created`);
}

async function seedMachines(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const models = await dataSource.getRepository(MachineModel).find({ order: { code: 'ASC' } });
  if (models.length === 0) {
    log.step('pagination machines: skipped, no models');
    return;
  }

  let created = 0;
  for (let index = 0; index < PAGINATION_SEED_COUNT; index += 1) {
    const serial = `${PREFIX}-SN-${String(2000 + index)}`;
    if (await dataSource.getRepository(Machine).exist({ where: { serial } })) continue;

    const model = models[index % models.length];
    await dataSource.transaction(async (manager: EntityManager) => {
      const machine = await manager.getRepository(Machine).save({
        serial,
        simSerial: `892001${String(3000000000 + index)}`,
        boxSerial: `${PREFIX}-BX-${2000 + index}`,
        qrPayload: null,
        machineModelId: model.id,
        machineTypeId: model.machineTypeId,
        purchasePrice: '4200.00',
        purchaseDate: '2025-02-10',
        factoryInvoiceNo: null,
        warrantyStart: '2025-02-10',
        warrantyEnd: '2027-02-10',
        status: MachineStatus.IN_COMPANY_WAREHOUSE,
        currentBranchId: null,
        currentWarehouseId: null,
        currentHolderType: null,
        currentHolderId: null,
        hasBox: true,
        totalRepairCost: '0',
        repairCount: 0,
        notes: null,
      });
      await manager.getRepository(Battery).save({
        serial: `${PREFIX}-BT-${2000 + index}`,
        machineId: machine.id,
        isActive: true,
      });
    });
    created += 1;
  }
  log.step(`pagination machines: ${created} created`);
}

async function seedMerchants(
  dataSource: DataSource,
  log: SeedLogger,
  branchId: string,
  createdByUserId: string,
): Promise<void> {
  const repo = dataSource.getRepository(Merchant);
  let created = 0;

  for (let index = 0; index < PAGINATION_SEED_COUNT; index += 1) {
    const phone = normalizePhone(`0101${String(2000000 + index).slice(0, 7)}`);
    if (await repo.exist({ where: { phone } })) continue;

    await repo.save({
      name: `تاجر صفحة ${index}`,
      phone,
      shopName: `محل صفحة ${index}`,
      address: 'شارع الصفحات، القاهرة',
      nationalId: null,
      branchId,
      createdByUserId,
      isActive: true,
      notes: null,
    });
    created += 1;
  }
  log.step(`pagination merchants: ${created} created`);
}

async function seedBudgets(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const existing = await dataSource
    .getRepository(FinanceCategoryTranslation)
    .createQueryBuilder('t')
    .where('t.locale = :locale', { locale: 'en' })
    .andWhere('t.name LIKE :prefix', { prefix: 'Page category %' })
    .getCount();
  if (existing >= PAGINATION_SEED_COUNT) {
    log.step('pagination budgets: already present');
    return;
  }

  let created = 0;
  for (let index = existing; index < PAGINATION_SEED_COUNT; index += 1) {
    await dataSource.transaction(async (manager: EntityManager) => {
      const id = randomUUID();
      const path = buildPath(null, id);
      // User-created categories must leave `code` null (chk_finance_categories_system_code).
      const category = await manager.getRepository(FinanceCategory).save({
        id,
        code: null,
        kind: FinanceKind.EXPENSE,
        parentId: null,
        path,
        depth: 0,
        isSystem: false,
        isActive: true,
        sortOrder: index,
      });
      await manager.getRepository(FinanceCategoryTranslation).save([
        {
          financeCategoryId: category.id,
          locale: 'ar',
          name: `تصنيف صفحة ${index}`,
          description: null,
        },
        {
          financeCategoryId: category.id,
          locale: 'en',
          name: `Page category ${index}`,
          description: null,
        },
      ]);
      await manager.getRepository(Budget).save({
        categoryId: category.id,
        branchId: null,
        periodType: BudgetPeriodType.MONTHLY,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        amount: String(1000 + index),
        alertThresholdPercent: 80,
        includeSubcategories: true,
        autoRenew: false,
        isActive: true,
        lastAlertLevel: null,
        lastAlertAt: null,
      });
    });
    created += 1;
  }
  log.step(`pagination budgets: ${created} created`);
}

async function seedSupervisors(
  dataSource: DataSource,
  log: SeedLogger,
  branchId: string,
): Promise<void> {
  const supervisorRole = await dataSource
    .getRepository(Role)
    .findOne({ where: { code: SystemRole.BRANCH_SUPERVISOR } });
  if (!supervisorRole) {
    log.step('pagination supervisors: skipped, role missing');
    return;
  }

  // `passwordHash` is `select: false`, so copy via a fresh hash of the shared dev password.
  const passwordHash = await argon2.hash(DEV_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  let created = 0;
  for (let index = 0; index < PAGINATION_SEED_COUNT; index += 1) {
    const phone = normalizePhone(`0102${String(3000000 + index).slice(0, 7)}`);
    if (await dataSource.getRepository(User).exist({ where: { phone } })) continue;

    await dataSource.getRepository(User).save({
      fullName: `مشرف صفحة ${index}`,
      phone,
      email: null,
      passwordHash,
      roleId: supervisorRole.id,
      branchId,
      isActive: true,
      mustChangePassword: false,
    });
    created += 1;
  }

  log.step(`pagination supervisors: ${created} created (password = ${DEV_PASSWORD})`);
}

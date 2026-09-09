import { DataSource, IsNull, ObjectLiteral, Repository } from 'typeorm';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { DecommissionReason } from 'src/modules/lookups/entities/decommission-reason.entity';
import { DecommissionReasonTranslation } from 'src/modules/lookups/entities/decommission-reason-translation.entity';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MachineModelTranslation } from 'src/modules/lookups/entities/machine-model-translation.entity';
import { MachineType } from 'src/modules/lookups/entities/machine-type.entity';
import { MachineTypeTranslation } from 'src/modules/lookups/entities/machine-type-translation.entity';
import { MaintenanceLocation } from 'src/modules/lookups/entities/maintenance-location.entity';
import { MaintenanceLocationTranslation } from 'src/modules/lookups/entities/maintenance-location-translation.entity';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { PaymentMethodTranslation } from 'src/modules/lookups/entities/payment-method-translation.entity';
import { ViolationType } from 'src/modules/lookups/entities/violation-type.entity';
import { ViolationTypeTranslation } from 'src/modules/lookups/entities/violation-type-translation.entity';
import {
  COMPANY_WAREHOUSES,
  DECOMMISSION_REASONS,
  MACHINE_MODELS,
  MACHINE_TYPES,
  MAINTENANCE_LOCATIONS,
  PAYMENT_METHODS,
  SeedLookup,
  VIOLATION_TYPES,
} from './lookups.catalogue';
import { SeedLogger } from './seed-logger';

/**
 * Seeds the reference tables in both locales plus the two company warehouses.
 *
 * Idempotent by `code`: an existing row has its `sort_order` and both translations refreshed
 * rather than being duplicated, so this can run on every deploy. Deliberately does **not**
 * reactivate a row an operator has retired.
 */
export async function seedOrganization(dataSource: DataSource, log: SeedLogger): Promise<void> {
  await seedLookup(dataSource, log, {
    label: 'machine types',
    parent: MachineType,
    translation: MachineTypeTranslation,
    parentKey: 'machineTypeId',
    rows: MACHINE_TYPES,
    extra: (row) => ({ requiresSim: row.requiresSim }),
  });

  await seedMachineModels(dataSource, log);

  await seedLookup(dataSource, log, {
    label: 'payment methods',
    parent: PaymentMethod,
    translation: PaymentMethodTranslation,
    parentKey: 'paymentMethodId',
    rows: PAYMENT_METHODS,
  });

  await seedLookup(dataSource, log, {
    label: 'violation types',
    parent: ViolationType,
    translation: ViolationTypeTranslation,
    parentKey: 'violationTypeId',
    rows: VIOLATION_TYPES,
    extra: (row) => ({ defaultSeverity: row.defaultSeverity }),
  });

  await seedLookup(dataSource, log, {
    label: 'maintenance locations',
    parent: MaintenanceLocation,
    translation: MaintenanceLocationTranslation,
    parentKey: 'maintenanceLocationId',
    rows: MAINTENANCE_LOCATIONS,
  });

  await seedLookup(dataSource, log, {
    label: 'decommission reasons',
    parent: DecommissionReason,
    translation: DecommissionReasonTranslation,
    parentKey: 'decommissionReasonId',
    rows: DECOMMISSION_REASONS,
  });

  await seedCompanyWarehouses(dataSource, log);
}

interface LookupSeedOptions<TRow extends SeedLookup> {
  label: string;
  parent: new () => ObjectLiteral;
  translation: new () => ObjectLiteral;
  /** Property on the translation entity holding the parent id, e.g. `machineTypeId`. */
  parentKey: string;
  rows: TRow[];
  extra?: (row: TRow) => ObjectLiteral;
}

async function seedLookup<TRow extends SeedLookup>(
  dataSource: DataSource,
  log: SeedLogger,
  options: LookupSeedOptions<TRow>,
): Promise<void> {
  const parents = dataSource.getRepository(options.parent);
  const translations = dataSource.getRepository(options.translation);

  let created = 0;
  let updated = 0;

  for (const row of options.rows) {
    const payload = { sortOrder: row.sortOrder, ...(options.extra?.(row) ?? {}) };
    const id = await upsertParent(parents, row.code, payload);

    if (id.wasCreated) created += 1;
    else updated += 1;

    await upsertTranslations(translations, options.parentKey, id.value, row);
  }

  log.step(`${options.label}: ${created} created, ${updated} updated`);
}

/** Machine models are seeded separately because each one resolves its type by code first. */
async function seedMachineModels(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const types = dataSource.getRepository(MachineType);
  const models = dataSource.getRepository(MachineModel);
  const translations = dataSource.getRepository(MachineModelTranslation);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of MACHINE_MODELS) {
    const type = await types.findOne({ where: { code: row.machineTypeCode } });
    if (!type) {
      // Only reachable if the catalogue references a type it does not also seed.
      log.step(`machine model ${row.code}: skipped, unknown type ${row.machineTypeCode}`);
      skipped += 1;
      continue;
    }

    const id = await upsertParent(models, row.code, {
      sortOrder: row.sortOrder,
      machineTypeId: type.id,
      manufacturer: row.manufacturer ?? null,
    });

    if (id.wasCreated) created += 1;
    else updated += 1;

    await upsertTranslations(translations, 'machineModelId', id.value, row);
  }

  const suffix = skipped > 0 ? `, ${skipped} skipped` : '';
  log.step(`machine models: ${created} created, ${updated} updated${suffix}`);
}

async function upsertParent(
  repository: Repository<ObjectLiteral>,
  code: string,
  payload: ObjectLiteral,
): Promise<{ value: string; wasCreated: boolean }> {
  const existing = await repository.findOne({ where: { code } });

  if (existing) {
    await repository.update(existing.id as string, payload);
    return { value: existing.id as string, wasCreated: false };
  }

  const saved = await repository.save(repository.create({ code, isActive: true, ...payload }));

  return { value: saved.id as string, wasCreated: true };
}

async function upsertTranslations(
  repository: Repository<ObjectLiteral>,
  parentKey: string,
  parentId: string,
  row: SeedLookup,
): Promise<void> {
  for (const locale of SUPPORTED_LOCALES) {
    const payload = row.translations[locale];
    if (!payload) continue;

    const values = {
      name: payload.name,
      ...(payload.description !== undefined ? { description: payload.description } : {}),
    };

    const existing = await repository.findOne({ where: { [parentKey]: parentId, locale } });

    if (existing) {
      await repository.update(existing.id as string, values);
    } else {
      await repository.save(repository.create({ [parentKey]: parentId, locale, ...values }));
    }
  }
}

/**
 * `COMPANY_MAIN` and `SCRAP` are singletons enforced by partial unique indexes, so this only
 * ever inserts when the row is absent.
 */
async function seedCompanyWarehouses(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const warehouses = dataSource.getRepository(Warehouse);
  let created = 0;

  for (const row of COMPANY_WAREHOUSES) {
    const type = row.type as WarehouseType;
    const existing = await warehouses.findOne({ where: { type, branchId: IsNull() } });

    if (existing) continue;

    await warehouses.save(
      warehouses.create({ type, name: row.name, branchId: null, isActive: true }),
    );
    created += 1;
  }

  log.step(
    `company warehouses: ${created} created, ${COMPANY_WAREHOUSES.length - created} present`,
  );
}

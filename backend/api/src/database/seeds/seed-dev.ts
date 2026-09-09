import { DataSource, EntityManager } from 'typeorm';
import * as argon2 from 'argon2';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { PartyType } from 'src/common/enums/transfer.enum';
import { normalizePhone } from 'src/common/utils/phone.util';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { Battery } from 'src/modules/machines/entities/battery.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { Role, SystemRole, SystemRoleCode } from 'src/modules/roles/entities/role.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { SeedLogger } from './seed-logger';

/**
 * Everyone gets the same password so the phone number is the only thing to remember while
 * developing. It still satisfies the password policy the change-password endpoint enforces.
 */
export const DEV_PASSWORD = 'Dev#12345';

interface DevBranch {
  code: string;
  name: string;
  warehouseName: string;
}

interface DevAccount {
  phone: string;
  fullName: string;
  role: SystemRoleCode;
  /** Which seeded branch the user belongs to; company-level roles pass `null`. */
  branchCode: string | null;
}

const BRANCHES: readonly DevBranch[] = [
  { code: 'CAIRO', name: 'فرع القاهرة', warehouseName: 'مخزن فرع القاهرة' },
  { code: 'ALEX', name: 'فرع الإسكندرية', warehouseName: 'مخزن فرع الإسكندرية' },
];

const ACCOUNTS: readonly DevAccount[] = [
  { phone: '01000000001', fullName: 'مدير التطوير', role: SystemRole.DIRECTOR, branchCode: null },
  {
    phone: '01000000002',
    fullName: 'مشرف فرع القاهرة',
    role: SystemRole.BRANCH_SUPERVISOR,
    branchCode: 'CAIRO',
  },
  {
    phone: '01000000003',
    fullName: 'مندوب القاهرة',
    role: SystemRole.REPRESENTATIVE,
    branchCode: 'CAIRO',
  },
  {
    phone: '01000000004',
    fullName: 'مشرف فرع الإسكندرية',
    role: SystemRole.BRANCH_SUPERVISOR,
    branchCode: 'ALEX',
  },
  {
    phone: '01000000005',
    fullName: 'محاسب التطوير',
    role: SystemRole.ACCOUNTANT,
    branchCode: null,
  },
  { phone: '01000000006', fullName: 'مشاهد التطوير', role: SystemRole.VIEWER, branchCode: null },
];

/**
 * Development-only data: two branches with their warehouses and one ready-to-use account per
 * role. Unlike the seeded Director, these accounts have `must_change_password = false`, so the
 * mobile app can sign in and land straight on a real screen.
 *
 * Idempotent by branch code and phone. Never run this against production — `run-seeds` guards
 * on `NODE_ENV`, and the fixed passwords are the reason.
 */
export async function seedDev(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const branchIds = await seedBranches(dataSource, log);
  await seedAccounts(dataSource, log, branchIds);
  await seedMachines(dataSource, log, branchIds);
}

async function seedBranches(dataSource: DataSource, log: SeedLogger): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let created = 0;

  for (const definition of BRANCHES) {
    const existing = await dataSource
      .getRepository(Branch)
      .findOne({ where: { code: definition.code } });

    if (existing) {
      ids.set(definition.code, existing.id);
      continue;
    }

    // A branch and its warehouse are created together, the same way BranchesService does it:
    // a branch without somewhere to put machines cannot take custody of anything.
    const id = await dataSource.transaction(async (manager: EntityManager) => {
      const branch = await manager.getRepository(Branch).save({
        code: definition.code,
        name: definition.name,
        address: null,
        phone: null,
        isActive: true,
      });

      await manager.getRepository(Warehouse).save({
        branchId: branch.id,
        type: WarehouseType.BRANCH,
        name: definition.warehouseName,
        isActive: true,
      });

      return branch.id;
    });

    ids.set(definition.code, id);
    created += 1;
  }

  log.step(`branches: ${created} created, ${BRANCHES.length - created} present`);
  return ids;
}

async function seedAccounts(
  dataSource: DataSource,
  log: SeedLogger,
  branchIds: Map<string, string>,
): Promise<void> {
  const users = dataSource.getRepository(User);
  const roles = dataSource.getRepository(Role);

  // Hashing is deliberately slow, so do it once for the shared password rather than per user.
  const passwordHash = await argon2.hash(DEV_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  let created = 0;

  for (const account of ACCOUNTS) {
    const phone = normalizePhone(account.phone);
    if (await users.findOne({ where: { phone } })) continue;

    const role = await roles.findOneOrFail({ where: { code: account.role } });

    await users.save(
      users.create({
        fullName: account.fullName,
        phone,
        email: null,
        passwordHash,
        roleId: role.id,
        branchId: account.branchCode ? (branchIds.get(account.branchCode) ?? null) : null,
        isActive: true,
        mustChangePassword: false,
      }),
    );

    created += 1;
  }

  log.step(`dev accounts: ${created} created, ${ACCOUNTS.length - created} present`);

  for (const account of ACCOUNTS) {
    const scope = account.branchCode ?? 'company';
    log.step(`  ${account.phone} — ${account.role} (${scope})`);
  }

  log.step(`password for every dev account: ${DEV_PASSWORD}`);
}

/**
 * A small fleet spread across statuses, branches and warranty states, so the mobile machines
 * screens have something to filter, and an empty list means a bug rather than an empty database.
 *
 * Custody is written directly here rather than through the transfer engine, which does not exist
 * yet. Once Phase 4 lands this becomes a set of confirmed transfers instead — until then, these
 * rows are what "a machine is with a representative" has to mean.
 */
async function seedMachines(
  dataSource: DataSource,
  log: SeedLogger,
  branchIds: Map<string, string>,
): Promise<void> {
  const machines = dataSource.getRepository(Machine);

  if ((await machines.count()) > 0) {
    log.step('machines: already present');
    return;
  }

  const models = await dataSource.getRepository(MachineModel).find({ order: { code: 'ASC' } });
  if (models.length === 0) {
    log.step('machines: skipped, no machine models are seeded');
    return;
  }

  const cairo = branchIds.get('CAIRO') ?? null;
  const alex = branchIds.get('ALEX') ?? null;

  const representative = await dataSource
    .getRepository(User)
    .findOne({ where: { phone: normalizePhone('01000000003') } });

  // A machine sitting in a warehouse is held *by* that warehouse, so the polymorphic holder id
  // has to resolve to a real row — `current_warehouse_id` and `current_holder_id` agree or the
  // custody columns contradict each other.
  const warehouses = await dataSource.getRepository(Warehouse).find();
  const companyWarehouse =
    warehouses.find((row) => row.type === WarehouseType.COMPANY_MAIN)?.id ?? null;
  const warehouseByBranch = new Map(
    warehouses
      .filter((row) => row.type === WarehouseType.BRANCH && row.branchId)
      .map((row) => [row.branchId!, row.id]),
  );

  const today = new Date();
  const plan = machinePlan({
    cairo,
    alex,
    companyWarehouse,
    cairoWarehouse: cairo ? (warehouseByBranch.get(cairo) ?? null) : null,
    alexWarehouse: alex ? (warehouseByBranch.get(alex) ?? null) : null,
    representativeId: representative?.id ?? null,
  });

  let created = 0;

  for (const [index, row] of plan.entries()) {
    const model = models[index % models.length];
    const serial = `SN-${String(1001 + index)}`;

    await dataSource.transaction(async (manager: EntityManager) => {
      const machine = await manager.getRepository(Machine).save({
        serial,
        simSerial: `8920011234567${String(890000 + index)}`,
        boxSerial: `BX-${String(1001 + index)}`,
        qrPayload: null,
        machineModelId: model.id,
        machineTypeId: model.machineTypeId,
        purchasePrice: '4200.00',
        purchaseDate: '2025-02-10',
        factoryInvoiceNo: 'F-2231',
        warrantyStart: '2025-02-10',
        warrantyEnd: isoDate(addDays(today, row.warrantyInDays)),
        status: row.status,
        currentBranchId: row.branchId,
        currentWarehouseId: row.warehouseId,
        currentHolderType: row.holderType,
        currentHolderId: row.holderId,
        hasBox: row.hasBox,
        totalRepairCost: row.totalRepairCost,
        repairCount: row.repairCount,
        notes: null,
      });

      await manager.getRepository(Battery).save({
        serial: `BT-${String(91001 + index)}`,
        machineId: machine.id,
        isActive: true,
      });
    });

    created += 1;
  }

  log.step(`machines: ${created} created with one battery each`);
}

interface DevMachine {
  status: MachineStatus;
  branchId: string | null;
  warehouseId: string | null;
  holderType: PartyType | null;
  holderId: string | null;
  hasBox: boolean;
  /** Negative for an expired warranty, so the "expiring soon" filter has both sides to sort. */
  warrantyInDays: number;
  totalRepairCost: string;
  repairCount: number;
}

interface DevCustody {
  cairo: string | null;
  alex: string | null;
  companyWarehouse: string | null;
  cairoWarehouse: string | null;
  alexWarehouse: string | null;
  representativeId: string | null;
}

function machinePlan(where: DevCustody): DevMachine[] {
  const inCompany = (warrantyInDays: number): DevMachine => ({
    status: MachineStatus.IN_COMPANY_WAREHOUSE,
    branchId: null,
    warehouseId: where.companyWarehouse,
    holderType: PartyType.WAREHOUSE,
    holderId: where.companyWarehouse,
    hasBox: true,
    warrantyInDays,
    totalRepairCost: '0.00',
    repairCount: 0,
  });

  const inBranch = (
    branchId: string | null,
    warehouseId: string | null,
    warrantyInDays: number,
  ): DevMachine => ({
    ...inCompany(warrantyInDays),
    status: MachineStatus.IN_BRANCH_WAREHOUSE,
    branchId,
    warehouseId,
    holderId: warehouseId,
  });

  const inCairo = (warrantyInDays: number): DevMachine =>
    inBranch(where.cairo, where.cairoWarehouse, warrantyInDays);
  const inAlex = (warrantyInDays: number): DevMachine =>
    inBranch(where.alex, where.alexWarehouse, warrantyInDays);

  return [
    inCompany(400),
    inCompany(320),
    inCompany(-30),
    inCairo(250),
    inCairo(45),
    inAlex(610),
    inAlex(-120),
    {
      // Out on the road: held by a person, so no warehouse, and the carton stayed behind.
      ...inCairo(180),
      status: MachineStatus.WITH_REPRESENTATIVE,
      warehouseId: null,
      holderType: where.representativeId ? PartyType.REPRESENTATIVE : PartyType.WAREHOUSE,
      holderId: where.representativeId ?? where.cairoWarehouse,
      hasBox: false,
    },
    {
      ...inCairo(90),
      status: MachineStatus.UNDER_MAINTENANCE,
      hasBox: false,
      totalRepairCost: '1850.00',
      repairCount: 3,
    },
    {
      ...inAlex(-400),
      status: MachineStatus.DECOMMISSIONED,
      hasBox: false,
      totalRepairCost: '3100.00',
      repairCount: 5,
    },
  ];
}

function addDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

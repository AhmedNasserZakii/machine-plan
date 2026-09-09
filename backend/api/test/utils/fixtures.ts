import { randomInt } from 'node:crypto';
import type { App } from 'supertest/types';
import { DIRECTOR_PASSWORD, seedDirectorPassword, seedDirectorPhone } from '../setup/test-env';
import { Api, ok } from './api-client';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  refreshExpiresAt: string;
  mustChangePassword: boolean;
}

export interface RoleRef {
  id: string;
  code: string;
}

export interface ProvisionedUser {
  id: string;
  phone: string;
  password: string;
  /** Authenticated as this user, past the forced password change. */
  api: Api;
}

export const TEST_DEVICE_ID = 'e2e-device';

export async function login(server: App, phone: string, password: string): Promise<Session> {
  const anon = new Api(server);
  return ok<Session>(anon.post('/auth/login', { phone, password, deviceId: TEST_DEVICE_ID }));
}

/**
 * Signs in the seeded Director, rotating the seed password on first use.
 *
 * Specs must not depend on each other's ordering, and Jest does not guarantee file order,
 * so this accepts either the seed password or the rotated one and converges on the latter.
 */
export async function loginAsDirector(server: App): Promise<Api> {
  const anon = new Api(server);

  const alreadyRotated = await anon.post('/auth/login', {
    phone: seedDirectorPhone(),
    password: DIRECTOR_PASSWORD,
    deviceId: TEST_DEVICE_ID,
  });

  if (alreadyRotated.status === 200) {
    return new Api(server, (alreadyRotated.body.data as Session).accessToken);
  }

  const first = await login(server, seedDirectorPhone(), seedDirectorPassword());

  if (first.mustChangePassword) {
    const pending = new Api(server, first.accessToken);
    await ok(
      pending.post('/auth/change-password', {
        currentPassword: seedDirectorPassword(),
        newPassword: DIRECTOR_PASSWORD,
      }),
    );
  }

  const rotated = await login(server, seedDirectorPhone(), DIRECTOR_PASSWORD);
  return new Api(server, rotated.accessToken);
}

export async function rolesByCode(director: Api): Promise<Map<string, RoleRef>> {
  const roles = await ok<RoleRef[]>(director.get('/roles'));
  return new Map(roles.map((role) => [role.code, role]));
}

export async function roleIdByCode(director: Api, code: string): Promise<string> {
  const role = (await rolesByCode(director)).get(code);
  if (!role) throw new Error(`role ${code} is not seeded`);
  return role.id;
}

/**
 * Creates a user and walks it through the forced first-login password change, returning a
 * client already authenticated as that user. This is how RBAC expectations get exercised
 * from the perspective of a real non-Director principal.
 */
export async function provisionUser(
  server: App,
  director: Api,
  options: { roleId: string; branchId?: string | null; fullName?: string },
): Promise<ProvisionedUser> {
  const phone = uniquePhone();
  const temporary = 'Temp#Pass1';
  const password = 'Final#Pass1';

  const created = await ok<{ id: string }>(
    director.post('/users', {
      fullName: options.fullName ?? 'مستخدم اختبار',
      phone,
      roleId: options.roleId,
      ...(options.branchId ? { branchId: options.branchId } : {}),
      password: temporary,
    }),
    201,
  );

  const first = await login(server, phone, temporary);
  const pending = new Api(server, first.accessToken);
  await ok(
    pending.post('/auth/change-password', {
      currentPassword: temporary,
      newPassword: password,
    }),
  );

  const session = await login(server, phone, password);

  return { id: created.id, phone, password, api: new Api(server, session.accessToken) };
}

export interface BranchFixture {
  id: string;
  code: string;
  name: string;
  warehouse?: { id: string; type: string } | null;
}

export async function createBranch(director: Api, name = 'فرع الاختبار'): Promise<BranchFixture> {
  return ok<BranchFixture>(director.post('/branches', { code: uniqueCode('BR'), name }), 201);
}

export interface MerchantFixture {
  id: string;
  name: string;
  shopName: string;
  phone: string;
}

/**
 * Registers a merchant as whoever `api` is signed in as, since the branch and the registering
 * representative are taken from the caller — a merchant created by the Director belongs to no
 * branch and would be invisible to the representative meant to deliver to him.
 */
export async function createMerchant(api: Api, name = 'تاجر الاختبار'): Promise<MerchantFixture> {
  return ok<MerchantFixture>(
    api.post('/merchants', {
      name,
      phone: uniquePhone(),
      shopName: `محل ${name}`,
      address: 'شارع الاختبار، القاهرة',
    }),
    201,
  );
}

let counter = 0;

/**
 * Random rather than time-derived: Jest gives each spec file its own module registry, so a
 * per-file counter seeded from the clock can hand two files the same value and fail a run
 * with a spurious conflict.
 */
function suffix(digits: number): string {
  counter += 1;
  const random = randomInt(0, 10 ** digits);
  return String((random + counter) % 10 ** digits).padStart(digits, '0');
}

/** Uppercase, underscore-safe and unique — matches the `^[A-Z][A-Z0-9_]*$` code rule. */
export function uniqueCode(prefix = 'E2E'): string {
  return `${prefix}_${suffix(6)}_${suffix(4)}`;
}

/** A unique, valid Egyptian mobile (`^01[0125]\d{8}$`). */
export function uniquePhone(): string {
  return `010${suffix(8)}`;
}

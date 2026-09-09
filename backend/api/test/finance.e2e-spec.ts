import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceKind, TransactionSource } from 'src/common/enums/finance.enum';
import { BudgetStatus } from 'src/modules/finance/budget-rules';
import { SystemCategoryCode } from 'src/modules/finance/services/finance-categories.service';
import {
  FinancePostingService,
  FinanceSourceRefType,
} from 'src/modules/finance/services/finance-posting.service';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { Api, fails, ok, okPage } from './utils/api-client';
import {
  createBranch,
  loginAsDirector,
  provisionUser,
  ProvisionedUser,
  roleIdByCode,
} from './utils/fixtures';
import { createTestApp } from './utils/test-app';

interface CategoryResponse {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  parentId: string | null;
  kind: FinanceKind;
  depth: number;
  isSystem: boolean;
  isActive: boolean;
  transactionCount: number;
  totalAmount: number;
  rolledUpTotal: number;
  children?: CategoryResponse[];
}

interface BreadcrumbResponse {
  id: string;
  code: string | null;
  name: string;
  depth: number;
}

interface TransactionResponse {
  id: string;
  referenceNo: string;
  kind: FinanceKind;
  amount: number;
  category: { id: string; code: string | null; name: string; path: string };
  transactionDate: string;
  paymentMethod: { id: string; name: string };
  branch: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  invoiceMediaId: string | null;
  notes: string | null;
  source: TransactionSource;
  sourceRefType: string | null;
  sourceRefId: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  isEditable: boolean;
  isVoidable: boolean;
}

interface SummaryResponse {
  period: { from: string; to: string };
  income: { total: number; count: number };
  expense: { total: number; count: number };
  net: number;
  comparison: {
    period: { from: string; to: string };
    incomeChangePercent: number | null;
    expenseChangePercent: number | null;
    netChangePercent: number | null;
  } | null;
  byPaymentMethod: { id: string; name: string; expense: number; income: number }[];
  topExpenseCategories: { id: string; name: string; total: number; percentOfExpense: number }[];
}

interface ByCategoryNode {
  id: string;
  name: string;
  depth: number;
  directTotal: number;
  rolledUpTotal: number;
  transactionCount: number;
  rolledUpCount: number;
  percentOfGrandTotal: number;
  percentOfParent: number | null;
  budget: { amount: number; usedPercent: number; status: BudgetStatus } | null;
  children: ByCategoryNode[];
}

interface ByCategoryResponse {
  period: { from: string; to: string };
  grandTotal: number;
  categories: ByCategoryNode[];
}

interface BudgetResponse {
  id: string;
  category: { id: string; name: string; path: string };
  branch: { id: string; name: string } | null;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  alertThresholdPercent: number;
  includeSubcategories: boolean;
  autoRenew: boolean;
  isActive: boolean;
  lastAlertLevel: string | null;
  lastAlertAt: string | null;
}

interface BudgetStatusEntry {
  id: string;
  category: { id: string; name: string; path: string };
  period: { start: string; end: string; daysElapsed: number; daysTotal: number };
  amount: number;
  spent: number;
  remaining: number;
  usedPercent: number;
  status: BudgetStatus;
  pace: { expectedSpendByNow: number; overPaceBy: number; projectedTotal: number };
  lastAlertLevel: string | null;
}

interface BudgetStatusListResponse {
  asOf: string;
  budgets: BudgetStatusEntry[];
  summary: { total: number; ok: number; warning: number; exceeded: number };
}

interface SupplierResponse {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
}

interface PaymentMethodResponse {
  id: string;
}

interface MerchantSubscriptionResponse {
  id: string;
  collectionCount: number;
  totalCollected: number;
}

interface ViolationResponse {
  id: string;
  status: string;
}

interface ViolationTypeResponse {
  id: string;
  code: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar day `daysAgo` in the past. Distinct offsets keep the aggregate specs apart. */
function day(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

function names(ar: string): Record<string, { name: string }> {
  return { ar: { name: ar }, en: { name: ar } };
}

describe('Finance (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let director: Api;

  let cashMethodId: string;
  let cardMethodId: string;
  let branchId: string;
  let otherBranchId: string;
  let branchAccountant: ProvisionedUser;
  let directorId: string;

  beforeAll(async () => {
    ({ app, server } = await createTestApp());
    director = await loginAsDirector(server);
    directorId = (await ok<{ id: string }>(director.get('/auth/me'))).id;

    const methods = await ok<PaymentMethodResponse[]>(director.get('/payment-methods'));
    cashMethodId = methods[0].id;
    cardMethodId = methods[1].id;

    branchId = (await createBranch(director, 'فرع المالية')).id;
    otherBranchId = (await createBranch(director, 'فرع المالية الثاني')).id;

    branchAccountant = await provisionUser(server, director, {
      roleId: await roleIdByCode(director, SystemRole.ACCOUNTANT),
      branchId,
      fullName: 'محاسب الفرع',
    });

    // The seeded Accountant role reads every branch. Denying that one permission is what makes
    // this principal the branch-scoped caller rule 8 of `15` is about.
    await ok(
      director.put(`/users/${branchAccountant.id}/permissions`, { deny: ['finance.read.all'] }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // ── fixtures ───────────────────────────────────────────────────────────────

  async function createCategory(
    name: string,
    kind: FinanceKind,
    parentId?: string,
  ): Promise<CategoryResponse> {
    return ok<CategoryResponse>(
      director.post('/finance/categories', {
        kind,
        translations: names(name),
        ...(parentId ? { parentId } : {}),
      }),
      201,
    );
  }

  /** `root → mid → { leafA, leafB }`, the shape the roll-up assertions need. */
  async function threeLevelTree(label: string): Promise<{
    root: CategoryResponse;
    mid: CategoryResponse;
    leafA: CategoryResponse;
    leafB: CategoryResponse;
  }> {
    const root = await createCategory(`${label} جذر`, FinanceKind.EXPENSE);
    const mid = await createCategory(`${label} وسط`, FinanceKind.EXPENSE, root.id);

    return {
      root,
      mid,
      leafA: await createCategory(`${label} ورقة أ`, FinanceKind.EXPENSE, mid.id),
      leafB: await createCategory(`${label} ورقة ب`, FinanceKind.EXPENSE, mid.id),
    };
  }

  async function book(
    api: Api,
    payload: {
      kind?: FinanceKind;
      amount: number;
      categoryId: string;
      transactionDate: string;
      branchId?: string;
      paymentMethodId?: string;
      supplierId?: string;
      notes?: string;
      clientUuid?: string;
    },
  ): Promise<TransactionResponse> {
    return ok<TransactionResponse>(
      api.post('/finance/transactions', {
        kind: payload.kind ?? FinanceKind.EXPENSE,
        amount: payload.amount,
        categoryId: payload.categoryId,
        transactionDate: payload.transactionDate,
        paymentMethodId: payload.paymentMethodId ?? cashMethodId,
        ...(payload.branchId ? { branchId: payload.branchId } : {}),
        ...(payload.supplierId ? { supplierId: payload.supplierId } : {}),
        ...(payload.notes ? { notes: payload.notes } : {}),
        ...(payload.clientUuid ? { clientUuid: payload.clientUuid } : {}),
      }),
      201,
    );
  }

  function categoryById(id: string): Promise<CategoryResponse> {
    return ok<CategoryResponse>(director.get(`/finance/categories/${id}`));
  }

  function budgetById(id: string): Promise<BudgetResponse> {
    return ok<BudgetResponse>(director.get(`/finance/budgets/${id}`));
  }

  // ── categories (14) ────────────────────────────────────────────────────────

  describe('the category tree', () => {
    it('seeds the four protected categories other modules post against', async () => {
      const all = await ok<CategoryResponse[]>(director.get('/finance/categories'));
      const system = new Map(all.filter((row) => row.isSystem).map((row) => [row.code, row]));

      expect(system.get(SystemCategoryCode.MAINTENANCE)?.kind).toBe(FinanceKind.EXPENSE);
      expect(system.get(SystemCategoryCode.MACHINE_PURCHASE)?.kind).toBe(FinanceKind.EXPENSE);
      expect(system.get(SystemCategoryCode.VIOLATION_CHARGES)?.kind).toBe(FinanceKind.INCOME);
      expect(system.get(SystemCategoryCode.MERCHANT_SUBSCRIPTIONS)?.kind).toBe(FinanceKind.INCOME);
    });

    it('nests to arbitrary depth and returns the whole tree in one call', async () => {
      const { root, mid, leafA } = await threeLevelTree('عمق');
      const deeper = await createCategory('أعمق', FinanceKind.EXPENSE, leafA.id);

      expect(deeper.depth).toBe(3);

      const tree = await ok<CategoryResponse[]>(director.get('/finance/categories/tree'));
      const found = tree.find((node) => node.id === root.id)!;

      expect(found.children![0].id).toBe(mid.id);
      expect(found.children![0].children!.map((node) => node.id).sort()).toContain(leafA.id);

      const grandchild = found.children![0].children!.find((node) => node.id === leafA.id)!;
      expect(grandchild.children![0].id).toBe(deeper.id);
    });

    /** `14`, rule 1: kind is inherited and immutable. */
    it('refuses an INCOME child under an EXPENSE parent', async () => {
      const parent = await createCategory('أب مصروف', FinanceKind.EXPENSE);

      await fails(
        director.post('/finance/categories', {
          kind: FinanceKind.INCOME,
          parentId: parent.id,
          translations: names('ابن إيراد'),
        }),
        422,
        'CATEGORY_KIND_MISMATCH',
      );
    });

    it('refuses to delete a system category', async () => {
      const all = await ok<CategoryResponse[]>(director.get('/finance/categories'));
      const maintenance = all.find((row) => row.code === SystemCategoryCode.MAINTENANCE)!;

      await fails(
        director.delete(`/finance/categories/${maintenance.id}`),
        403,
        'SYSTEM_CATEGORY_PROTECTED',
      );
    });

    it('refuses to delete a category that has children', async () => {
      const { root } = await threeLevelTree('أطفال');

      await fails(director.delete(`/finance/categories/${root.id}`), 409, 'CATEGORY_HAS_CHILDREN');
    });

    it('refuses to delete a category with transactions and names the count', async () => {
      const category = await createCategory('تصنيف بحركات', FinanceKind.EXPENSE);
      await book(director, { amount: 100, categoryId: category.id, transactionDate: day(1) });

      const error = await fails(
        director.delete(`/finance/categories/${category.id}`),
        409,
        'CATEGORY_HAS_TRANSACTIONS',
      );

      expect(error.message).toContain('1');
    });

    it('removes an unused category and deactivates one with history instead', async () => {
      const disposable = await createCategory('تصنيف للحذف', FinanceKind.EXPENSE);
      await director.delete(`/finance/categories/${disposable.id}`).expect(204);
      await fails(director.get(`/finance/categories/${disposable.id}`), 404, 'NOT_FOUND');

      const kept = await createCategory('تصنيف للتعطيل', FinanceKind.EXPENSE);
      await book(director, { amount: 50, categoryId: kept.id, transactionDate: day(1) });

      const deactivated = await ok<CategoryResponse>(
        director.patch(`/finance/categories/${kept.id}`, { isActive: false }),
      );

      expect(deactivated.isActive).toBe(false);
      // Hidden from pickers, but the transaction it carries is untouched.
      expect((await categoryById(kept.id)).transactionCount).toBe(1);
    });

    it('rewrites the path and depth of every descendant on a move', async () => {
      const { root, mid, leafA, leafB } = await threeLevelTree('نقل');
      const newParent = await createCategory('أب جديد', FinanceKind.EXPENSE);

      const moved = await ok<CategoryResponse>(
        director.patch(`/finance/categories/${mid.id}/move`, { newParentId: newParent.id }),
      );

      expect(moved.parentId).toBe(newParent.id);
      expect(moved.depth).toBe(1);
      expect((await categoryById(leafA.id)).depth).toBe(2);
      expect((await categoryById(leafB.id)).depth).toBe(2);

      // The breadcrumb is read off the materialized path, so it proves the rewrite landed.
      const trail = await ok<BreadcrumbResponse[]>(
        director.get(`/finance/categories/${leafA.id}/breadcrumb`),
      );

      expect(trail.map((node) => node.id)).toEqual([newParent.id, mid.id, leafA.id]);
      expect((await categoryById(root.id)).rolledUpTotal).toBe(0);
    });

    it('promotes a subtree to the root when moved with no new parent', async () => {
      const { mid, leafA } = await threeLevelTree('ترقية');

      const moved = await ok<CategoryResponse>(
        director.patch(`/finance/categories/${mid.id}/move`, {}),
      );

      expect(moved.parentId).toBeNull();
      expect(moved.depth).toBe(0);
      expect((await categoryById(leafA.id)).depth).toBe(1);
    });

    it('refuses to move a node under its own child', async () => {
      const { root, mid, leafA } = await threeLevelTree('دورة');

      await fails(
        director.patch(`/finance/categories/${root.id}/move`, { newParentId: mid.id }),
        422,
        'CIRCULAR_CATEGORY_REFERENCE',
      );

      await fails(
        director.patch(`/finance/categories/${root.id}/move`, { newParentId: leafA.id }),
        422,
        'CIRCULAR_CATEGORY_REFERENCE',
      );

      await fails(
        director.patch(`/finance/categories/${root.id}/move`, { newParentId: root.id }),
        422,
        'CIRCULAR_CATEGORY_REFERENCE',
      );
    });

    it('refuses to move a category under a parent of the other kind', async () => {
      const expense = await createCategory('مصروف للنقل', FinanceKind.EXPENSE);
      const income = await createCategory('إيراد للنقل', FinanceKind.INCOME);

      await fails(
        director.patch(`/finance/categories/${expense.id}/move`, { newParentId: income.id }),
        422,
        'CATEGORY_KIND_MISMATCH',
      );
    });

    it('rolls a grandchild total up to the grandparent', async () => {
      const { root, mid, leafA, leafB } = await threeLevelTree('تجميع');

      await book(director, { amount: 300, categoryId: leafA.id, transactionDate: day(2) });
      await book(director, { amount: 200, categoryId: leafB.id, transactionDate: day(2) });
      await book(director, { amount: 100, categoryId: mid.id, transactionDate: day(2) });

      const grandparent = await categoryById(root.id);

      expect(grandparent.totalAmount).toBe(0);
      expect(grandparent.rolledUpTotal).toBe(600);
      expect((await categoryById(mid.id)).totalAmount).toBe(100);
      expect((await categoryById(mid.id)).rolledUpTotal).toBe(600);
    });

    it('renames a category per locale without touching its identity', async () => {
      const category = await createCategory('اسم قديم', FinanceKind.EXPENSE);

      await ok(
        director.patch(`/finance/categories/${category.id}`, {
          translations: { ar: { name: 'اسم جديد' }, en: { name: 'A new name' } },
        }),
      );

      expect((await categoryById(category.id)).name).toBe('اسم جديد');
      expect(
        (
          await ok<CategoryResponse>(
            director.withLocale('en').get(`/finance/categories/${category.id}`),
          )
        ).name,
      ).toBe('A new name');
    });

    it('requires the default locale on create', async () => {
      await fails(
        director.post('/finance/categories', {
          kind: FinanceKind.EXPENSE,
          translations: { en: { name: 'English only' } },
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('refuses a caller without finance.categories.manage', async () => {
      const viewer = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.VIEWER),
        fullName: 'مشاهد المالية',
      });

      await fails(
        viewer.api.post('/finance/categories', {
          kind: FinanceKind.EXPENSE,
          translations: names('محاولة'),
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );
    });
  });

  // ── transactions (15) ──────────────────────────────────────────────────────

  describe('booking a transaction', () => {
    it('books an expense with a reference number and both action flags', async () => {
      const category = await createCategory('حركة عادية', FinanceKind.EXPENSE);

      const created = await book(director, {
        amount: 1250.5,
        categoryId: category.id,
        transactionDate: day(3),
        notes: 'فاتورة قطع غيار',
      });

      expect(created.referenceNo).toMatch(/^EXP-\d{4}-\d{6}$/);
      expect(created.amount).toBe(1250.5);
      expect(created.source).toBe(TransactionSource.MANUAL);
      expect(created.branch).toBeNull();
      expect(created.isEditable).toBe(true);
      expect(created.isVoidable).toBe(true);
    });

    it('numbers income rows from their own sequence', async () => {
      const category = await createCategory('إيراد عادي', FinanceKind.INCOME);

      const created = await book(director, {
        kind: FinanceKind.INCOME,
        amount: 900,
        categoryId: category.id,
        transactionDate: day(3),
      });

      expect(created.referenceNo).toMatch(/^INC-\d{4}-\d{6}$/);
    });

    /** `15`, rule 1. */
    it('refuses an expense booked under an income category', async () => {
      const income = await createCategory('تصنيف إيراد', FinanceKind.INCOME);

      await fails(
        director.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 100,
          categoryId: income.id,
          transactionDate: day(1),
          paymentMethodId: cashMethodId,
        }),
        422,
        'CATEGORY_KIND_MISMATCH',
      );
    });

    /** `15`, rule 2. */
    it('refuses a date in the future', async () => {
      const category = await createCategory('تصنيف للمستقبل', FinanceKind.EXPENSE);

      await fails(
        director.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 100,
          categoryId: category.id,
          transactionDate: day(-1),
          paymentMethodId: cashMethodId,
        }),
        422,
        'FUTURE_DATE_NOT_ALLOWED',
      );
    });

    /** `15`, rule 3: the limit stops a year-typo but must not block a legitimate catch-up. */
    it('holds a caller without finance.update to the backdate limit', async () => {
      const category = await createCategory('تصنيف قديم', FinanceKind.EXPENSE);

      const dataEntry = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.ACCOUNTANT),
        branchId,
        fullName: 'مدخل بيانات',
      });

      await ok(director.put(`/users/${dataEntry.id}/permissions`, { deny: ['finance.update'] }));

      await fails(
        dataEntry.api.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 100,
          categoryId: category.id,
          transactionDate: day(200),
          paymentMethodId: cashMethodId,
        }),
        422,
        'BACKDATE_LIMIT_EXCEEDED',
      );

      // The Director holds `finance.update`, so the same entry is allowed for him.
      const caught = await book(director, {
        amount: 100,
        categoryId: category.id,
        transactionDate: day(200),
      });

      expect(caught.transactionDate).toBe(day(200));
    });

    it('rejects an unknown category, payment method and supplier by name', async () => {
      const category = await createCategory('تصنيف صالح', FinanceKind.EXPENSE);

      const unknownCategory = await fails(
        director.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 100,
          categoryId: randomUUID(),
          transactionDate: day(1),
          paymentMethodId: cashMethodId,
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(unknownCategory.details?.[0].field).toBe('categoryId');

      const unknownMethod = await fails(
        director.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 100,
          categoryId: category.id,
          transactionDate: day(1),
          paymentMethodId: randomUUID(),
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(unknownMethod.details?.[0].field).toBe('paymentMethodId');

      const unknownSupplier = await fails(
        director.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 100,
          categoryId: category.id,
          transactionDate: day(1),
          paymentMethodId: cashMethodId,
          supplierId: randomUUID(),
        }),
        400,
        'VALIDATION_FAILED',
      );
      expect(unknownSupplier.details?.[0].field).toBe('supplierId');
    });

    /** Offline idempotency: a submit sent twice off a flaky connection is not a conflict. */
    it('returns the row it already created when a submit is replayed', async () => {
      const category = await createCategory('تصنيف التكرار', FinanceKind.EXPENSE);
      const clientUuid = randomUUID();

      const first = await book(director, {
        amount: 400,
        categoryId: category.id,
        transactionDate: day(4),
        clientUuid,
      });

      const replay = await ok<TransactionResponse>(
        director.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 400,
          categoryId: category.id,
          transactionDate: day(4),
          paymentMethodId: cashMethodId,
          clientUuid,
        }),
        201,
      );

      expect(replay.id).toBe(first.id);
      expect((await categoryById(category.id)).transactionCount).toBe(1);
    });
  });

  describe('correcting and voiding', () => {
    it('corrects a manual row inside its edit window', async () => {
      const category = await createCategory('تصنيف للتعديل', FinanceKind.EXPENSE);
      const other = await createCategory('تصنيف بديل', FinanceKind.EXPENSE);
      const created = await book(director, {
        amount: 100,
        categoryId: category.id,
        transactionDate: day(5),
      });

      const revised = await ok<TransactionResponse>(
        director.patch(`/finance/transactions/${created.id}`, {
          amount: 175.25,
          categoryId: other.id,
          notes: 'تصحيح المبلغ',
        }),
      );

      expect(revised.amount).toBe(175.25);
      expect(revised.category.id).toBe(other.id);
      expect(revised.notes).toBe('تصحيح المبلغ');
    });

    it('refuses to move a row into a category of the other kind', async () => {
      const expense = await createCategory('مصروف مثبت', FinanceKind.EXPENSE);
      const income = await createCategory('إيراد مثبت', FinanceKind.INCOME);
      const created = await book(director, {
        amount: 100,
        categoryId: expense.id,
        transactionDate: day(5),
      });

      await fails(
        director.patch(`/finance/transactions/${created.id}`, { categoryId: income.id }),
        422,
        'CATEGORY_KIND_MISMATCH',
      );
    });

    /** `15`, rule 4: never deleted, and the row stays readable with its reason attached. */
    it('voids a row, keeps it readable and refuses a second void', async () => {
      const category = await createCategory('تصنيف للإلغاء', FinanceKind.EXPENSE);
      const created = await book(director, {
        amount: 500,
        categoryId: category.id,
        transactionDate: day(6),
      });

      const voided = await ok<TransactionResponse>(
        director.post(`/finance/transactions/${created.id}/void`, {
          reason: 'سُجلت مرتين بالخطأ',
        }),
      );

      expect(voided.isVoided).toBe(true);
      expect(voided.voidReason).toBe('سُجلت مرتين بالخطأ');
      expect(voided.voidedAt).not.toBeNull();
      expect(voided.isEditable).toBe(false);
      expect(voided.isVoidable).toBe(false);

      // Out of the default list, still there behind the flag.
      const hidden = await okPage<TransactionResponse>(
        director.get(`/finance/transactions?categoryId=${category.id}`),
      );
      expect(hidden.items).toHaveLength(0);

      const shown = await okPage<TransactionResponse>(
        director.get(`/finance/transactions?categoryId=${category.id}&includeVoided=true`),
      );
      expect(shown.items.map((row) => row.id)).toEqual([created.id]);

      await fails(
        director.post(`/finance/transactions/${created.id}/void`, { reason: 'مرة أخرى' }),
        409,
        'TRANSACTION_ALREADY_VOIDED',
      );

      await fails(
        director.patch(`/finance/transactions/${created.id}`, { amount: 1 }),
        409,
        'TRANSACTION_ALREADY_VOIDED',
      );
    });

    it('refuses a void with no usable reason', async () => {
      const category = await createCategory('تصنيف بدون سبب', FinanceKind.EXPENSE);
      const created = await book(director, {
        amount: 100,
        categoryId: category.id,
        transactionDate: day(6),
      });

      await fails(
        director.post(`/finance/transactions/${created.id}/void`, { reason: 'لا' }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('takes a voided row out of the summary', async () => {
      const category = await createCategory('تصنيف الملخص', FinanceKind.EXPENSE);
      const date = day(7);

      const kept = await book(director, {
        amount: 700,
        categoryId: category.id,
        transactionDate: date,
      });
      const doomed = await book(director, {
        amount: 900,
        categoryId: category.id,
        transactionDate: date,
      });

      const before = await ok<SummaryResponse>(
        director.get(`/finance/summary?dateFrom=${date}&dateTo=${date}`),
      );
      expect(before.expense.total).toBeGreaterThanOrEqual(1600);

      await ok(
        director.post(`/finance/transactions/${doomed.id}/void`, { reason: 'مبلغ خاطئ تماماً' }),
      );

      const after = await ok<SummaryResponse>(
        director.get(`/finance/summary?dateFrom=${date}&dateTo=${date}`),
      );

      expect(after.expense.total).toBe(before.expense.total - 900);
      expect(after.expense.count).toBe(before.expense.count - 1);
      // The kept row is still counted, so this is not a filter that dropped the whole day.
      expect((await categoryById(category.id)).totalAmount).toBe(700);
      void kept;
    });
  });

  // ── auto-posted rows ───────────────────────────────────────────────────────

  describe('auto-posted rows', () => {
    /**
     * `15`, rule 5. Posted through the service the maintenance module will call, which is also
     * the proof that wiring maintenance close is the one-line call it is meant to be.
     */
    it('refuses to edit or void an AUTO_MAINTENANCE transaction', async () => {
      const posting = app.get(FinancePostingService);
      const dataSource = app.get(DataSource);
      const orderId = randomUUID();

      const posted = await dataSource.transaction((manager) =>
        posting.post(
          {
            kind: FinanceKind.EXPENSE,
            amount: 1500,
            categoryCode: SystemCategoryCode.MAINTENANCE,
            transactionDate: day(8),
            paymentMethodId: cashMethodId,
            branchId: null,
            source: TransactionSource.AUTO_MAINTENANCE,
            sourceRefType: FinanceSourceRefType.MAINTENANCE_ORDER,
            sourceRefId: orderId,
            notes: 'إصلاح شاشة',
            actorId: directorId,
          },
          manager,
        ),
      );

      const read = await ok<TransactionResponse>(
        director.get(`/finance/transactions/${posted.id}`),
      );

      expect(read.source).toBe(TransactionSource.AUTO_MAINTENANCE);
      expect(read.category.code).toBe(SystemCategoryCode.MAINTENANCE);
      expect(read.isEditable).toBe(false);
      expect(read.isVoidable).toBe(false);

      await fails(
        director.patch(`/finance/transactions/${posted.id}`, { amount: 1 }),
        422,
        'AUTO_TRANSACTION_IMMUTABLE',
      );

      await fails(
        director.post(`/finance/transactions/${posted.id}/void`, { reason: 'محاولة إلغاء' }),
        422,
        'AUTO_TRANSACTION_IMMUTABLE',
      );

      // `uq_ft_source_ref` is what makes a replayed close a no-op rather than a second row.
      const replay = await dataSource.transaction((manager) =>
        posting.post(
          {
            kind: FinanceKind.EXPENSE,
            amount: 1500,
            categoryCode: SystemCategoryCode.MAINTENANCE,
            transactionDate: day(8),
            paymentMethodId: cashMethodId,
            branchId: null,
            source: TransactionSource.AUTO_MAINTENANCE,
            sourceRefType: FinanceSourceRefType.MAINTENANCE_ORDER,
            sourceRefId: orderId,
            actorId: directorId,
          },
          manager,
        ),
      );

      expect(replay.id).toBe(posted.id);
    });

    it('posts a violation charge as income, once, against VIOLATION_CHARGES', async () => {
      const supervisor = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.BRANCH_SUPERVISOR),
        branchId,
        fullName: 'مشرف للمخالفة',
      });

      const representative = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId,
        fullName: 'مندوب للمخالفة',
      });

      const types = await ok<ViolationTypeResponse[]>(director.get('/violation-types'));
      const typeId = types.find((type) => type.code === 'OTHER')!.id;

      const violation = await ok<ViolationResponse>(
        supervisor.api.post('/violations', {
          violationTypeId: typeId,
          userId: representative.id,
          severity: 'LOW',
          description: 'مخالفة للتحصيل المالي',
        }),
        201,
      );

      await ok(
        director.post(`/violations/${violation.id}/charge`, {
          amount: 250,
          paymentMethodId: cashMethodId,
          chargedAt: new Date().toISOString(),
        }),
      );

      const { items } = await okPage<TransactionResponse>(
        director.get(`/finance/transactions?source=AUTO_VIOLATION&limit=100`),
      );
      const posted = items.filter((row) => row.sourceRefId === violation.id);

      expect(posted).toHaveLength(1);
      expect(posted[0].kind).toBe(FinanceKind.INCOME);
      expect(posted[0].amount).toBe(250);
      expect(posted[0].category.code).toBe(SystemCategoryCode.VIOLATION_CHARGES);
      expect(posted[0].sourceRefType).toBe(FinanceSourceRefType.VIOLATION);
      expect(posted[0].branch?.id).toBe(branchId);

      // A second charge is refused upstream, so the ledger cannot gain a second row either.
      await fails(
        director.post(`/violations/${violation.id}/charge`, {
          amount: 250,
          paymentMethodId: cashMethodId,
          chargedAt: new Date().toISOString(),
        }),
        409,
        'ALREADY_CHARGED',
      );

      const after = await okPage<TransactionResponse>(
        director.get(`/finance/transactions?source=AUTO_VIOLATION&limit=100`),
      );
      expect(after.items.filter((row) => row.sourceRefId === violation.id)).toHaveLength(1);
    });

    /**
     * A plan is collected from every month, so each collection has to reach the ledger — while a
     * retry of the same one must not. The identity is the plan plus the collection's sequence.
     */
    it('posts every subscription collection as its own income row', async () => {
      const representative = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.REPRESENTATIVE),
        branchId,
        fullName: 'مندوب للاشتراك',
      });

      const merchant = await ok<{ id: string }>(
        representative.api.post('/merchants', {
          name: 'تاجر الاشتراك المالي',
          phone: `0100${String(Date.now()).slice(-7)}`,
          shopName: 'محل الاشتراك',
          address: 'شارع الاختبار، القاهرة',
        }),
        201,
      );

      // A price no other spec uses, so the ledger query below can isolate these two rows.
      const price = 337.25;

      const subscription = await ok<MerchantSubscriptionResponse>(
        director.post(`/merchants/${merchant.id}/subscriptions`, {
          planType: 'MONTHLY',
          amount: price,
          startDate: day(40),
        }),
        201,
      );

      await ok(
        director.post(`/subscriptions/${subscription.id}/collect`, {
          amount: price,
          collectedAt: new Date(Date.now() - 10 * DAY_MS).toISOString(),
          paymentMethodId: cashMethodId,
        }),
      );

      await ok(
        director.post(`/subscriptions/${subscription.id}/collect`, {
          amount: price,
          collectedAt: new Date().toISOString(),
          paymentMethodId: cashMethodId,
        }),
      );

      const { items: posted } = await okPage<TransactionResponse>(
        director.get(
          `/finance/transactions?source=AUTO_SUBSCRIPTION&minAmount=${price}&maxAmount=${price}`,
        ),
      );

      // Both collections are in the ledger, each with its own derived identity.
      expect(posted).toHaveLength(2);
      expect(new Set(posted.map((row) => row.sourceRefId)).size).toBe(2);
      expect(posted.every((row) => row.kind === FinanceKind.INCOME)).toBe(true);
      expect(
        posted.every((row) => row.sourceRefType === FinanceSourceRefType.SUBSCRIPTION_COLLECTION),
      ).toBe(true);
      expect(
        posted.every((row) => row.category.code === SystemCategoryCode.MERCHANT_SUBSCRIPTIONS),
      ).toBe(true);
    });
  });

  // ── reports (15) ───────────────────────────────────────────────────────────

  describe('the reports', () => {
    it('matches a three-level roll-up to the sum of its leaves', async () => {
      const { root, mid, leafA, leafB } = await threeLevelTree('تقرير');
      const from = day(12);
      const to = day(10);

      await book(director, { amount: 24200, categoryId: leafA.id, transactionDate: day(11) });
      await book(director, { amount: 4200, categoryId: leafB.id, transactionDate: day(11) });
      await book(director, { amount: 1600, categoryId: mid.id, transactionDate: day(11) });

      const report = await ok<ByCategoryResponse>(
        director.get(
          `/finance/by-category?dateFrom=${from}&dateTo=${to}&rootCategoryId=${root.id}`,
        ),
      );

      const reported = report.categories[0];
      const reportedMid = reported.children[0];
      const leaves = reportedMid.children;

      expect(report.grandTotal).toBe(30000);
      expect(reported.directTotal).toBe(0);
      expect(reported.rolledUpTotal).toBe(30000);
      expect(reported.percentOfGrandTotal).toBe(100);

      expect(reportedMid.directTotal).toBe(1600);
      expect(reportedMid.rolledUpTotal).toBe(30000);
      expect(reportedMid.rolledUpCount).toBe(3);

      // The stated invariant: a parent's roll-up is its own spend plus every leaf under it.
      expect(leaves.reduce((sum, node) => sum + node.rolledUpTotal, 0)).toBe(
        reportedMid.rolledUpTotal - reportedMid.directTotal,
      );
      expect(leaves.find((node) => node.id === leafA.id)!.percentOfParent).toBe(80.7);
    });

    it('honours maxDepth without losing the totals of the levels it cut', async () => {
      const { root, leafA } = await threeLevelTree('عمق التقرير');
      await book(director, { amount: 500, categoryId: leafA.id, transactionDate: day(13) });

      const report = await ok<ByCategoryResponse>(
        director.get(
          `/finance/by-category?dateFrom=${day(13)}&dateTo=${day(13)}&rootCategoryId=${root.id}&maxDepth=1`,
        ),
      );

      expect(report.categories[0].rolledUpTotal).toBe(500);
      expect(report.categories[0].children[0].rolledUpTotal).toBe(500);
      expect(report.categories[0].children[0].children).toEqual([]);
    });

    it('reports income when asked for it', async () => {
      const income = await createCategory('إيراد التقرير', FinanceKind.INCOME);
      await book(director, {
        kind: FinanceKind.INCOME,
        amount: 800,
        categoryId: income.id,
        transactionDate: day(14),
      });

      const report = await ok<ByCategoryResponse>(
        director.get(
          `/finance/by-category?dateFrom=${day(14)}&dateTo=${day(14)}&kind=INCOME&rootCategoryId=${income.id}`,
        ),
      );

      expect(report.categories[0].rolledUpTotal).toBe(800);
    });

    it('summarises income, expense, net and the payment-method split', async () => {
      const expense = await createCategory('مصروف الملخص', FinanceKind.EXPENSE);
      const income = await createCategory('إيراد الملخص', FinanceKind.INCOME);
      const date = day(15);

      await book(director, { amount: 1000, categoryId: expense.id, transactionDate: date });
      await book(director, {
        amount: 250,
        categoryId: expense.id,
        transactionDate: date,
        paymentMethodId: cardMethodId,
      });
      await book(director, {
        kind: FinanceKind.INCOME,
        amount: 3000,
        categoryId: income.id,
        transactionDate: date,
      });

      const summary = await ok<SummaryResponse>(
        director.get(`/finance/summary?dateFrom=${date}&dateTo=${date}`),
      );

      expect(summary.period).toEqual({ from: date, to: date });
      expect(summary.expense.total).toBe(1250);
      expect(summary.income.total).toBe(3000);
      expect(summary.net).toBe(1750);

      const card = summary.byPaymentMethod.find((row) => row.id === cardMethodId)!;
      expect(card.expense).toBe(250);
      expect(card.income).toBe(0);

      expect(summary.topExpenseCategories.map((row) => row.id)).toContain(expense.id);
      expect(summary.comparison).toBeNull();
    });

    it('compares against the equally long window before it', async () => {
      const category = await createCategory('مقارنة', FinanceKind.EXPENSE);

      await book(director, { amount: 100, categoryId: category.id, transactionDate: day(31) });
      await book(director, { amount: 150, categoryId: category.id, transactionDate: day(30) });

      const summary = await ok<SummaryResponse>(
        director.get(
          `/finance/summary?dateFrom=${day(30)}&dateTo=${day(30)}&compareToPrevious=true`,
        ),
      );

      expect(summary.comparison!.period).toEqual({ from: day(31), to: day(31) });
      expect(summary.comparison!.expenseChangePercent).toBe(50);
    });

    it('defaults the period to the current month', async () => {
      const summary = await ok<SummaryResponse>(director.get('/finance/summary'));
      const month = new Date().toISOString().slice(0, 7);

      expect(summary.period.from).toBe(`${month}-01`);
      expect(summary.period.to.startsWith(month)).toBe(true);
    });
  });

  // ── export (15) ────────────────────────────────────────────────────────────

  describe('the export', () => {
    it('streams the selection back as CSV with a UTF-8 BOM', async () => {
      const category = await createCategory('تصدير', FinanceKind.EXPENSE);
      const supplier = await ok<SupplierResponse>(
        director.post('/suppliers', { name: 'مورد التصدير', phone: '0223456789' }),
        201,
      );

      const created = await book(director, {
        amount: 640,
        categoryId: category.id,
        transactionDate: day(16),
        supplierId: supplier.id,
        notes: 'ملاحظة, بها فاصلة',
      });

      const csv = await exportCsv(
        `categoryId=${category.id}&dateFrom=${day(16)}&dateTo=${day(16)}`,
      );

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('reference_no');
      expect(csv).toContain(created.referenceNo);
      expect(csv).toContain('مورد التصدير');
      // RFC 4180: a field carrying the delimiter comes back quoted.
      expect(csv).toContain('"ملاحظة, بها فاصلة"');
    });

    /** Superseded the old `501 EXPORT_FORMAT_UNAVAILABLE` once `exceljs` arrived with `17`. */
    it('streams the same selection back as a workbook', async () => {
      const response = await director.get('/finance/export?format=xlsx').expect(200);

      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(response.headers['content-disposition']).toContain('.xlsx');
    });

    it('refuses a caller without reports.export', async () => {
      await fails(director.as(null).get('/finance/export'), 401, 'UNAUTHENTICATED');

      const viewer = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.VIEWER),
        branchId,
        fullName: 'مشاهد التصدير',
      });

      await fails(viewer.api.get('/finance/export'), 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  // ── suppliers (15) ─────────────────────────────────────────────────────────

  describe('suppliers', () => {
    it('registers one and finds it by a partial name', async () => {
      const created = await ok<SupplierResponse>(
        director.post('/suppliers', { name: 'شركة قطع الغيار المتحدة', phone: '0225551234' }),
        201,
      );

      expect(created.isActive).toBe(true);

      const found = await ok<SupplierResponse[]>(director.get('/suppliers?search=الغيار'));
      expect(found.map((row) => row.id)).toContain(created.id);
    });

    it('lets whoever can book an expense name the shop it was paid to', async () => {
      const created = await ok<SupplierResponse>(
        branchAccountant.api.post('/suppliers', { name: 'مورد المحاسب' }),
        201,
      );

      expect(created.name).toBe('مورد المحاسب');
    });

    it('refuses a caller with no finance permissions at all', async () => {
      const viewer = await provisionUser(server, director, {
        roleId: await roleIdByCode(director, SystemRole.VIEWER),
        fullName: 'مشاهد الموردين',
      });

      await fails(viewer.api.get('/suppliers'), 403, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  // ── branch scoping (15, rule 8) ────────────────────────────────────────────

  describe('branch scoping', () => {
    it('hides another branch\u2019s transactions from a branch-scoped caller', async () => {
      const category = await createCategory('تصنيف الفروع', FinanceKind.EXPENSE);

      const mine = await book(director, {
        amount: 111,
        categoryId: category.id,
        transactionDate: day(17),
        branchId,
      });

      const theirs = await book(director, {
        amount: 222,
        categoryId: category.id,
        transactionDate: day(17),
        branchId: otherBranchId,
      });

      const company = await book(director, {
        amount: 333,
        categoryId: category.id,
        transactionDate: day(17),
      });

      const { items } = await okPage<TransactionResponse>(
        branchAccountant.api.get(`/finance/transactions?categoryId=${category.id}&limit=50`),
      );
      const visible = items.map((row) => row.id);

      expect(visible).toContain(mine.id);
      // Company-level rows are shared, which is the rest of rule 8.
      expect(visible).toContain(company.id);
      expect(visible).not.toContain(theirs.id);

      // Reading it directly is a 404, not a 403: an id must not be probeable across branches.
      await fails(branchAccountant.api.get(`/finance/transactions/${theirs.id}`), 404, 'NOT_FOUND');

      // And the summary a branch caller pulls carries only what he may see.
      const summary = await ok<SummaryResponse>(
        branchAccountant.api.get(`/finance/summary?dateFrom=${day(17)}&dateTo=${day(17)}`),
      );
      expect(summary.expense.total).toBe(444);

      // Asking for the other branch by name is refused rather than silently narrowed.
      await fails(
        branchAccountant.api.get(`/finance/transactions?branchId=${otherBranchId}`),
        403,
        'BRANCH_SCOPE_VIOLATION',
      );
    });

    it('refuses to book against a branch the caller does not belong to', async () => {
      const category = await createCategory('تصنيف حجز الفرع', FinanceKind.EXPENSE);

      await fails(
        branchAccountant.api.post('/finance/transactions', {
          kind: FinanceKind.EXPENSE,
          amount: 100,
          categoryId: category.id,
          transactionDate: day(18),
          paymentMethodId: cashMethodId,
          branchId: otherBranchId,
        }),
        403,
        'BRANCH_SCOPE_VIOLATION',
      );
    });
  });

  // ── budgets (16) ───────────────────────────────────────────────────────────

  describe('budgets', () => {
    /** A whole calendar month in the past, so the pace figures are stable and complete. */
    const PERIOD_START = '2026-01-01';
    const PERIOD_END = '2026-01-31';

    async function createBudget(
      categoryId: string,
      amount: number,
      overrides: Record<string, unknown> = {},
    ): Promise<BudgetResponse> {
      return ok<BudgetResponse>(
        director.post('/finance/budgets', {
          categoryId,
          periodType: 'MONTHLY',
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          amount,
          ...overrides,
        }),
        201,
      );
    }

    /** Inside the budget period, which is older than the backdate limit — hence the Director. */
    async function spend(categoryId: string, amount: number): Promise<TransactionResponse> {
      return book(director, { amount, categoryId, transactionDate: '2026-01-15' });
    }

    function statusOf(budget: BudgetResponse): Promise<BudgetStatusEntry> {
      return ok<BudgetStatusListResponse>(
        director.get('/finance/budgets/status?asOf=2026-01-15'),
      ).then((list) => list.budgets.find((entry) => entry.id === budget.id)!);
    }

    it('refuses a budget on an income category', async () => {
      const income = await createCategory('إيراد للميزانية', FinanceKind.INCOME);

      await fails(
        director.post('/finance/budgets', {
          categoryId: income.id,
          periodType: 'MONTHLY',
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          amount: 1000,
        }),
        422,
        'BUDGET_ON_INCOME_CATEGORY',
      );
    });

    it('refuses a budget overlapping one that already covers the window', async () => {
      const category = await createCategory('ميزانية متداخلة', FinanceKind.EXPENSE);
      await createBudget(category.id, 10000);

      await fails(
        director.post('/finance/budgets', {
          categoryId: category.id,
          periodType: 'CUSTOM',
          periodStart: '2026-01-15',
          periodEnd: '2026-02-15',
          amount: 5000,
        }),
        409,
        'OVERLAPPING_BUDGET',
      );

      // The following month does not overlap, so it is allowed.
      await ok(
        director.post('/finance/budgets', {
          categoryId: category.id,
          periodType: 'MONTHLY',
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
          amount: 5000,
        }),
        201,
      );
    });

    /** `16`, rule 4: a parent budget and a child budget are evaluated independently. */
    it('lets a parent budget and a child budget coexist', async () => {
      const { mid, leafA } = await threeLevelTree('ميزانية الأب');

      const parent = await createBudget(mid.id, 10000);
      const child = await createBudget(leafA.id, 3000);

      await spend(leafA.id, 2000);

      expect((await statusOf(parent)).spent).toBe(2000);
      expect((await statusOf(child)).spent).toBe(2000);
      expect((await statusOf(child)).usedPercent).toBe(66.7);
    });

    /** `16`, rule 2 and its negation. */
    it('ignores child-category spend when includeSubcategories is false', async () => {
      const { mid, leafA } = await threeLevelTree('بدون فروع');

      const rolled = await createBudget(mid.id, 10000);
      const direct = await createBudget(mid.id, 10000, {
        includeSubcategories: false,
        periodType: 'CUSTOM',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
      });

      await spend(leafA.id, 4000);
      await book(director, { amount: 1000, categoryId: mid.id, transactionDate: '2026-03-15' });

      expect((await statusOf(rolled)).spent).toBe(4000);

      const directStatus = await ok<BudgetStatusListResponse>(
        director.get('/finance/budgets/status?asOf=2026-03-15'),
      ).then((list) => list.budgets.find((entry) => entry.id === direct.id)!);

      // Only what was booked on the node itself, even though a descendant spent more.
      expect(directStatus.spent).toBe(1000);
    });

    it('reports the pace that makes a budget actionable', async () => {
      const category = await createCategory('إيقاع', FinanceKind.EXPENSE);
      const budget = await createBudget(category.id, 30000);

      await book(director, {
        amount: 27400,
        categoryId: category.id,
        transactionDate: '2026-01-07',
      });

      const status = await ok<BudgetStatusListResponse>(
        director.get('/finance/budgets/status?asOf=2026-01-07'),
      ).then((list) => list.budgets.find((entry) => entry.id === budget.id)!);

      expect(status.period).toMatchObject({ daysElapsed: 7, daysTotal: 31 });
      expect(status.spent).toBe(27400);
      expect(status.remaining).toBe(2600);
      expect(status.usedPercent).toBe(91.3);
      expect(status.status).toBe(BudgetStatus.WARNING);
      expect(status.pace.expectedSpendByNow).toBe(6774.19);
      expect(status.pace.overPaceBy).toBeGreaterThan(20000);
      expect(status.pace.projectedTotal).toBeGreaterThan(100000);
    });

    /**
     * `16`, rule 4 of the alert engine: without escalation-only recording, every transaction
     * booked after 80% would notify the Director again and the one that mattered would be lost.
     */
    it('records a WARNING once and stays quiet on the next transaction below 100%', async () => {
      const category = await createCategory('تحذير مرة واحدة', FinanceKind.EXPENSE);
      const budget = await createBudget(category.id, 1000);

      expect(budget.lastAlertLevel).toBeNull();

      await spend(category.id, 700);
      expect((await budgetById(budget.id)).lastAlertLevel).toBeNull();

      await spend(category.id, 150);
      const warned = await budgetById(budget.id);

      expect(warned.lastAlertLevel).toBe(BudgetStatus.WARNING);
      expect(warned.lastAlertAt).not.toBeNull();

      await spend(category.id, 50);
      const still = await budgetById(budget.id);

      // Same level, so nothing new was announced: the timestamp is the observable for that.
      expect(still.lastAlertLevel).toBe(BudgetStatus.WARNING);
      expect(still.lastAlertAt).toBe(warned.lastAlertAt);
      expect((await statusOf(budget)).status).toBe(BudgetStatus.WARNING);
    });

    it('records an EXCEEDED once when the limit is crossed', async () => {
      const category = await createCategory('تجاوز مرة واحدة', FinanceKind.EXPENSE);
      const budget = await createBudget(category.id, 1000);

      await spend(category.id, 850);
      expect((await budgetById(budget.id)).lastAlertLevel).toBe(BudgetStatus.WARNING);

      await spend(category.id, 200);
      const exceeded = await budgetById(budget.id);

      expect(exceeded.lastAlertLevel).toBe(BudgetStatus.EXCEEDED);
      expect((await statusOf(budget)).status).toBe(BudgetStatus.EXCEEDED);
      expect((await statusOf(budget)).remaining).toBeLessThan(0);

      await spend(category.id, 100);
      const after = await budgetById(budget.id);

      expect(after.lastAlertLevel).toBe(BudgetStatus.EXCEEDED);
      expect(after.lastAlertAt).toBe(exceeded.lastAlertAt);
    });

    it('lets a void move the status back down without announcing anything', async () => {
      const category = await createCategory('عودة للأسفل', FinanceKind.EXPENSE);
      const budget = await createBudget(category.id, 1000);

      const crossing = await spend(category.id, 1100);
      const exceeded = await budgetById(budget.id);

      expect(exceeded.lastAlertLevel).toBe(BudgetStatus.EXCEEDED);

      await ok(
        director.post(`/finance/transactions/${crossing.id}/void`, {
          reason: 'قيد خاطئ تم إلغاؤه',
        }),
      );

      const status = await statusOf(budget);
      expect(status.spent).toBe(0);
      expect(status.status).toBe(BudgetStatus.OK);

      // The recorded level stays put, so the same warning is not sent twice for this period.
      const after = await budgetById(budget.id);
      expect(after.lastAlertLevel).toBe(BudgetStatus.EXCEEDED);
      expect(after.lastAlertAt).toBe(exceeded.lastAlertAt);
    });

    it('hangs the budget block on the by-category report', async () => {
      const category = await createCategory('ميزانية في التقرير', FinanceKind.EXPENSE);
      const budget = await createBudget(category.id, 10000);

      await spend(category.id, 8740);

      const report = await ok<ByCategoryResponse>(
        director.get(
          `/finance/by-category?dateFrom=${PERIOD_START}&dateTo=${PERIOD_END}&rootCategoryId=${category.id}`,
        ),
      );

      expect(report.categories[0].budget).toEqual({
        amount: 10000,
        usedPercent: 87.4,
        status: BudgetStatus.WARNING,
      });
      void budget;
    });

    it('deletes a budget without touching the transactions under it', async () => {
      const category = await createCategory('حذف ميزانية', FinanceKind.EXPENSE);
      const budget = await createBudget(category.id, 5000);
      const booked = await spend(category.id, 1200);

      await director.delete(`/finance/budgets/${budget.id}`).expect(204);
      await fails(director.get(`/finance/budgets/${budget.id}`), 404, 'NOT_FOUND');

      const kept = await ok<TransactionResponse>(
        director.get(`/finance/transactions/${booked.id}`),
      );
      expect(kept.amount).toBe(1200);
    });

    it('revises the limit and the threshold in place', async () => {
      const category = await createCategory('تعديل ميزانية', FinanceKind.EXPENSE);
      const budget = await createBudget(category.id, 1000);

      await spend(category.id, 600);

      const revised = await ok<BudgetResponse>(
        director.patch(`/finance/budgets/${budget.id}`, {
          amount: 2000,
          alertThresholdPercent: 50,
        }),
      );

      expect(revised.amount).toBe(2000);
      expect(revised.alertThresholdPercent).toBe(50);
      expect((await statusOf(revised)).usedPercent).toBe(30);
      expect((await statusOf(revised)).status).toBe(BudgetStatus.OK);
    });

    it('refuses a period that ends before it starts', async () => {
      const category = await createCategory('فترة مقلوبة', FinanceKind.EXPENSE);

      await fails(
        director.post('/finance/budgets', {
          categoryId: category.id,
          periodType: 'CUSTOM',
          periodStart: '2026-05-31',
          periodEnd: '2026-05-01',
          amount: 1000,
        }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('refuses a caller without finance.budgets.manage', async () => {
      const category = await createCategory('ميزانية ممنوعة', FinanceKind.EXPENSE);

      await ok(
        director.put(`/users/${branchAccountant.id}/permissions`, {
          deny: ['finance.read.all', 'finance.budgets.manage'],
        }),
      );

      await fails(
        branchAccountant.api.post('/finance/budgets', {
          categoryId: category.id,
          periodType: 'MONTHLY',
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          amount: 1000,
        }),
        403,
        'INSUFFICIENT_PERMISSIONS',
      );

      await ok(
        director.put(`/users/${branchAccountant.id}/permissions`, {
          deny: ['finance.read.all'],
        }),
      );
    });

    it('summarises the status list by level', async () => {
      const list = await ok<BudgetStatusListResponse>(
        director.get('/finance/budgets/status?asOf=2026-01-15'),
      );

      expect(list.asOf).toBe('2026-01-15');
      expect(list.summary.total).toBe(list.budgets.length);
      expect(list.summary.ok + list.summary.warning + list.summary.exceeded).toBe(
        list.budgets.length,
      );
    });
  });

  /** The export writes the body itself, so it is read off the raw response rather than `data`. */
  async function exportCsv(query: string): Promise<string> {
    const response = await director.get(`/finance/export?${query}`);

    if (response.status !== 200) {
      throw new Error(`expected 200 from the export, got ${response.status}: ${response.text}`);
    }
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');

    return response.text;
  }
});

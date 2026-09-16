import { expect, test } from '@playwright/test';

import { accounts, expectNoMoneyAmounts, loginAs, runAxe } from './helpers';

test.beforeAll(async () => {
  for (let i = 0; i < 10; i++) {
    const health = await fetch('http://127.0.0.1:3000/health').catch(() => null);
    if (health?.ok) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Backend API must be running on :3000 (npm run start:dev in backend/api)');
});

test('1 — login lands on dashboard', async ({ page }) => {
  await loginAs(page, 'director');
  await expect(page).toHaveURL(/\/(ar|en)(\/)?(\?|$)/);
  await expect(page.getByRole('navigation').first()).toBeVisible();
});

test('2 — machines list opens a detail row', async ({ page }) => {
  await loginAs(page, 'supervisor');
  await page.goto('/ar/machines');
  await expect(page.getByRole('heading').first()).toBeVisible();
  const link = page.locator('table tbody tr a').first();
  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();
  await expect(page).toHaveURL(/\/machines\//);
  await expect(page.locator('[data-slot="machine-sticker"]')).toBeVisible();
});

test('5 — confirm pending transfer if present', async ({ page }) => {
  await loginAs(page, 'representative');
  await page.goto('/ar/transfers?view=incoming');
  await expect(page.getByRole('heading').first()).toBeVisible();
  const row = page.locator('table tbody tr a').first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    const confirm = page.getByRole('button', { name: /confirm|تأكيد/i }).first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
  }
});

test('6 — reject pending transfer if present', async ({ page }) => {
  await loginAs(page, 'representative');
  await page.goto('/ar/transfers?view=incoming');
  const row = page.locator('table tbody tr a').first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    const reject = page.getByRole('button', { name: /reject|رفض/i }).first();
    if (await reject.isVisible().catch(() => false)) {
      await reject.click();
      const reason = page.getByLabel(/reason|سبب/i).first();
      if (await reason.isVisible().catch(() => false)) {
        await reason.fill('e2e reject');
      }
    }
  }
});

test('12 — run a report and print layout', async ({ page }) => {
  await loginAs(page, 'director');
  await page.goto('/ar/reports/machines-inventory');
  await expect(page.locator('.report-print')).toBeVisible({ timeout: 20_000 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-only').first()).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
});

test('15 — money-leak: supervisor sees no finance amounts', async ({ page }) => {
  await loginAs(page, 'supervisor');
  for (const path of ['/ar', '/ar/machines', '/ar/maintenance', '/ar/violations', '/ar/merchants']) {
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    await expectNoMoneyAmounts(page);
  }
});

test('16 — locale switch preserves route and query', async ({ page }) => {
  await loginAs(page, 'director');
  await page.goto('/ar/machines?page=1&limit=25&search=test');
  await page.getByRole('group', { name: /locale|لغة|language/i }).getByRole('button', { name: /EN|English|إنجليزي/i }).click();
  await expect(page).toHaveURL(/\/en\/machines/);
  await expect(page).toHaveURL(/search=test/);
  await expect(page).toHaveURL(/limit=25/);
});

test('17 — session logout clears app shell', async ({ page }) => {
  await loginAs(page, 'viewer');
  await page.goto('/ar');
  await page.getByRole('button', { name: /log ?out|خروج/i }).click();
  await expect(page).toHaveURL(/login/, { timeout: 15_000 });
});

test('axe: login + dashboard routes have no serious/critical', async ({ page }) => {
  await page.goto('/ar/login');
  let violations = await runAxe(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);

  await loginAs(page, 'director');
  await page.goto('/ar');
  await page.waitForLoadState('networkidle');
  violations = await runAxe(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test('keyboard: login form is operable without mouse', async ({ page }) => {
  await page.goto('/ar/login');
  await page.locator('#phone').focus();
  await page.keyboard.type(accounts.viewer.phone);
  await page.locator('#password').focus();
  await page.keyboard.type(accounts.viewer.password);
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
});

test('RTL document direction on Arabic routes', async ({ page }) => {
  await page.goto('/ar/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.goto('/en/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('role walk: each seeded role reaches a coherent shell', async ({ page }) => {
  for (const role of ['director', 'supervisor', 'representative', 'accountant', 'viewer'] as const) {
    await page.context().clearCookies();
    await loginAs(page, role);
    await expect(page.getByRole('navigation').first()).toBeVisible();
    await page.request.post('/api/bff/logout');
  }
});

test('error paths: invalid login + 404', async ({ page }) => {
  await page.goto('/ar/login');
  await page.locator('#phone').fill('01000000999');
  await page.locator('#password').fill('WrongPass#1');
  await page.getByRole('button', { name: /sign in|دخول|تسجيل/i }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });

  await loginAs(page, 'director');
  await page.goto('/ar/machines/00000000-0000-0000-0000-000000000000');
  await expect(
    page.getByText(/not found|غير موجود|404|error|خطأ|retry|إعادة/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test('print CSS hides chrome on report viewer', async ({ page }) => {
  await loginAs(page, 'director');
  await page.goto('/ar/reports/machines-inventory');
  await expect(page.locator('.report-print')).toBeVisible({ timeout: 20_000 });
  await page.emulateMedia({ media: 'print' });
  const sidebar = page.locator('[data-slot="sidebar"]');
  if (await sidebar.count()) {
    await expect(sidebar.first()).toBeHidden();
  }
});

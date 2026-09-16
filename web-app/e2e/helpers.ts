import { expect, type Page } from '@playwright/test';

export const DEV_PASSWORD = 'Dev#12345';

export const accounts = {
  director: { phone: '01000000001', password: DEV_PASSWORD },
  supervisor: { phone: '01000000002', password: DEV_PASSWORD },
  representative: { phone: '01000000003', password: DEV_PASSWORD },
  accountant: { phone: '01000000005', password: DEV_PASSWORD },
  viewer: { phone: '01000000006', password: DEV_PASSWORD },
} as const;

export type RoleKey = keyof typeof accounts;

export async function loginAs(page: Page, role: RoleKey, locale: 'ar' | 'en' = 'ar') {
  const account = accounts[role];
  await page.goto(`/${locale}/login`);
  await page.getByLabel(/phone|هاتف|رقم/i).fill(account.phone);
  await page.getByLabel(/password|كلمة/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|دخول|تسجيل/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

export async function expectNoMoneyAmounts(page: Page) {
  const moneyLike = page.locator('[data-slot="money"], .t-mono').filter({ hasText: /EGP|ج\.م|£|\$/ });
  const visible = await moneyLike.count();
  for (let i = 0; i < visible; i++) {
    const text = (await moneyLike.nth(i).innerText()).trim();
    expect(text === '——' || text === '—' || text === '').toBeTruthy();
  }
}

/** Inject axe-core from CDN (no new npm package) and return serious/critical violations. */
export async function runAxe(page: Page) {
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js',
  });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axe = (window as any).axe;
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return (r.violations as Array<{ impact?: string; id: string; help: string; nodes: unknown[] }>).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
  });
  return results;
}

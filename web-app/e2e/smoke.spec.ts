import { expect, test } from '@playwright/test';

test('login route renders in Arabic by default', async ({ page }) => {
  await page.goto('/ar/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: /sign in|دخول|تسجيل/i })).toBeVisible();
});

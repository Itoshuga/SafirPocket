import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/booster-products', (route) => route.fulfill({ json: [] }));
});

test('the guest homepage exposes the primary journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('collection claire');
  await expect(page.getByRole('link', { name: /explorer les cartes/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Catalogue public' })).toBeVisible();
});

test('the layout does not overflow at supported widths', async ({ page }) => {
  for (const width of [375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test('mobile navigation exposes secondary sections', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Plus' }).click();
  await expect(page.getByRole('link', { name: 'Classement' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Profil' })).toBeVisible();
});

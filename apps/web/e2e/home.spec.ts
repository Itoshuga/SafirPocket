import { expect, test } from '@playwright/test';

test('homepage exposes the main collection journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Safir Pocket');
  await expect(page.getByRole('link', { name: /explorer les cartes/i })).toBeVisible();
});

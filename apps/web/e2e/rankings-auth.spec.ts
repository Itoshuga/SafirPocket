import { expect, test } from '@playwright/test';

test('public rankings render authoritative season data', async ({ page }) => {
  await page.route('**/api/v1/rankings**', (route) =>
    route.fulfill({
      json: {
        season: {
          id: '11111111-1111-4111-8111-111111111111',
          slug: 's1',
          name: 'Saison 1',
          startsAt: '2026-01-01T00:00:00.000Z',
          endsAt: '2027-01-01T00:00:00.000Z',
        },
        data: [
          {
            rank: 1,
            rating: 1420,
            wins: 12,
            losses: 3,
            draws: 1,
            user: {
              id: '22222222-2222-4222-8222-222222222222',
              username: 'amira',
              displayName: 'Amira',
              avatarUrl: null,
              bio: null,
              role: 'USER',
            },
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
      },
    }),
  );
  await page.goto('/rankings');
  await expect(page.getByText('Saison 1')).toBeVisible();
  await expect(page.getByText('Amira', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('1420', { exact: true }).filter({ visible: true })).toBeVisible();
});

test('private areas redirect anonymous users to login', async ({ page }) => {
  for (const path of ['/collection', '/decks', '/boosters', '/play', '/profile', '/admin']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole('heading', { level: 1, name: 'Se connecter' })).toBeVisible();
  }
});

test('login exposes accessible validation errors', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();
  await expect(
    page.getByText('Le mot de passe doit contenir au moins 8 caractères.'),
  ).toBeVisible();
});

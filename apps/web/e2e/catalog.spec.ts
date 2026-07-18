import { expect, test } from '@playwright/test';

const cardId = '11111111-1111-4111-8111-111111111111';
const card = {
  id: cardId,
  setId: '22222222-2222-4222-8222-222222222222',
  name: 'Sentinelle de Safir',
  slug: 'sentinelle-de-safir',
  number: 1,
  collectionNumber: '001',
  attack: 2,
  defense: 3,
  value: 2,
  description: 'Une protectrice attentive.',
  imageUrl: null,
  isCommander: false,
  rarity: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Rare',
    slug: 'rare',
    displayColor: '#9A6700',
  },
  season: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Origines',
    slug: 'origines',
    code: 'ORI',
  },
  types: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Allié',
      slug: 'allie',
      displayColor: null,
    },
  ],
  cardType: 'Allié',
  cost: 2,
  artworkPath: null,
  status: 'published',
  isActive: true,
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
  set: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Origines',
    slug: 'origines',
    code: 'ORI',
  },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/cards/${cardId}`)) {
      await route.fulfill({
        json: {
          ...card,
          effectText: 'Piochez une carte.',
          stats: { force: 2 },
          effects: [],
          metadata: {},
          variants: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              cardId,
              name: 'Standard',
              slug: 'standard',
              finish: 'standard',
              artworkPath: null,
            },
          ],
        },
      });
      return;
    }
    if (url.pathname.endsWith('/card-facets')) {
      await route.fulfill({
        json: {
          sets: [{ ...card.set, description: null, releaseDate: null, cardCount: 1 }],
          seasons: [
            {
              ...card.season,
              description: null,
              startDate: null,
              endDate: null,
              isActive: true,
              sortOrder: 0,
              cardCount: 1,
            },
          ],
          rarities: [
            {
              ...card.rarity,
              description: null,
              sortOrder: 0,
              isActive: true,
              cardCount: 1,
            },
          ],
          types: [
            {
              ...card.types[0],
              description: null,
              sortOrder: 0,
              isActive: true,
              cardCount: 1,
            },
          ],
        },
      });
      return;
    }
    if (url.pathname.endsWith('/cards')) {
      await route.fulfill({
        json: { data: [card], pagination: { page: 1, pageSize: 36, total: 1, pageCount: 1 } },
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: { error: { code: 'NOT_FOUND', message: 'Not found' } },
    });
  });
});

test('catalog filters are URL-backed and card detail is reachable', async ({ page }) => {
  await page.goto('/cards');
  await expect(page.getByText('Sentinelle de Safir')).toBeVisible();
  const filterButton = page.getByRole('button', { name: /Filtres/ });
  const mobileFilters = await filterButton.isVisible();
  if (mobileFilters) await filterButton.click();
  const season = mobileFilters
    ? page.getByRole('dialog').getByLabel('Saison')
    : page.getByLabel('Saison');
  await season.selectOption('origines');
  await expect(page).toHaveURL(/set=origines/);
  if (mobileFilters) await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  await page
    .getByRole('link', { name: /Sentinelle de Safir/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sentinelle de Safir' })).toBeVisible();
  await expect(page.getByText('Piochez une carte.')).toBeVisible();
});

test('catalog remains usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/cards');
  await expect(page.getByRole('button', { name: /Filtres/ })).toBeVisible();
  await expect(page.getByText('Sentinelle de Safir')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

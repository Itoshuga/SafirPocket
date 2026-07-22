import { PROFILE_SEASON_PREVIEW_CARD_LIMIT } from '@safir/shared-types';
import { expect, test, type Page } from '@playwright/test';

const userId = '11111111-1111-4111-8111-111111111111';
const friendId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const cardId = '44444444-4444-4444-8444-444444444444';
const variantId = '55555555-5555-4555-8555-555555555555';
const timestamp = '2026-07-19T10:00:00.000Z';
const email = 'profile-e2e@example.com';
const password = 'E2E-password-only!';
const accessToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      exp: 4_102_444_800,
    }),
  ).toString('base64url'),
  'e2e-signature',
].join('.');

const authUser = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  email_confirmed_at: timestamp,
  last_sign_in_at: timestamp,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: timestamp,
  updated_at: timestamp,
};

const profile = {
  id: userId,
  username: 'safir_e2e',
  normalizedUsername: 'safir_e2e',
  email,
  displayName: 'Safir E2E',
  avatarUrl: null,
  bannerUrl: null,
  bannerPositionY: 50,
  bio: 'Profil de test',
  role: 'USER',
  roleLabel: 'Utilisateur',
  status: 'ACTIVE',
  statusLabel: 'Actif',
  suspendedUntil: null,
  mustChangePassword: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: timestamp,
  usernameChangedAt: null,
  usernameChangeAvailableAt: null,
  isDeactivated: false,
  deactivatedAt: null,
  deletion: {
    state: 'NONE',
    requestedAt: null,
    scheduledFor: null,
    cancelledAt: null,
    processedAt: null,
  },
};

const friend = {
  id: friendId,
  username: 'lucas_e2e',
  displayName: 'Lucas E2E',
  avatarUrl: null,
  role: 'USER',
  roleLabel: 'Utilisateur',
  isPioneer: false,
};

const card = {
  id: cardId,
  setId: null,
  name: 'Sentinelle sociale',
  slug: 'sentinelle-sociale',
  number: 7,
  collectionNumber: '7',
  attack: 3,
  defense: 4,
  value: 2,
  description: null,
  imageUrl: null,
  artworkPath: null,
  isCommander: false,
  rarity: { id: 'rarity', name: 'Rare', slug: 'rare', displayColor: null },
  season: { id: 'season', name: 'Origines', slug: 'origines', code: 'ORI' },
  types: [{ id: 'type', name: 'Allié', slug: 'allie', displayColor: null }],
  cardType: 'Allié',
  cost: 2,
  status: 'published',
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const collectionEntry = {
  cardVariantId: variantId,
  quantity: 3,
  lockedQuantity: 1,
  firstObtainedAt: timestamp,
  lastObtainedAt: timestamp,
  variant: {
    id: variantId,
    name: 'Standard',
    finish: 'standard',
    artworkPath: null,
    card,
  },
};

const seasonCollectionItem = {
  card,
  owned: true,
  quantity: 3,
  lockedQuantity: 1,
  ownedVariants: [
    {
      cardVariantId: variantId,
      name: 'Standard',
      finish: 'standard',
      artworkPath: null,
      quantity: 3,
      lockedQuantity: 1,
      lastObtainedAt: timestamp,
    },
  ],
};

const fullSeasonCollectionItems = Array.from({ length: 6 }, (_, index) => {
  if (index === 0) return seasonCollectionItem;
  const suffix = String(index + 1).padStart(12, '0');
  return {
    ...seasonCollectionItem,
    card: {
      ...seasonCollectionItem.card,
      id: `44444444-4444-4444-8444-${suffix}`,
      name: `Carte de saison ${index + 1}`,
      slug: `carte-de-saison-${index + 1}`,
      number: index + 1,
      collectionNumber: String(index + 1),
    },
    ownedVariants: seasonCollectionItem.ownedVariants.map((variant) => ({
      ...variant,
      cardVariantId: `55555555-5555-4555-8555-${suffix}`,
    })),
  };
});

const seasonPreviewCards = fullSeasonCollectionItems.slice(0, PROFILE_SEASON_PREVIEW_CARD_LIMIT);

const seasonSummary = {
  season: {
    id: 'season',
    name: 'Origines',
    slug: 'origines',
    code: 'ORI',
    imageUrl: null,
    sortOrder: 1,
  },
  collection: {
    uniqueOwnedCards: 7,
    totalAvailableCards: 20,
    totalCopies: 12,
    completionPercentage: 35,
  },
  previewCards: seasonPreviewCards,
};

const emptySeasonSummary = {
  season: {
    id: 'season-empty',
    name: 'Héritage',
    slug: 'heritage',
    code: 'HER',
    imageUrl: null,
    sortOrder: 2,
  },
  collection: {
    uniqueOwnedCards: 0,
    totalAvailableCards: 10,
    totalCopies: 0,
    completionPercentage: 0,
  },
  previewCards: [],
};

async function mockPersonalSpace(page: Page) {
  const mutations: string[] = [];
  let currentProfile = { ...profile };
  let preferences = {
    userId,
    profileVisibility: 'PUBLIC',
    collectionVisibility: 'PUBLIC',
    allowFriendRequests: true,
    appearInUserSearch: true,
    showOnlineStatus: false,
    showCollectionStats: true,
    showCardQuantities: true,
    showCollectionCompletion: true,
    showGameStats: true,
    emailNotifications: true,
    friendRequestNotifications: true,
    friendAcceptanceNotifications: true,
    gameInviteNotifications: true,
    gameNewsNotifications: true,
    marketingEmails: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      json: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 2_147_483_647,
        expires_at: 4_102_444_800,
        refresh_token: 'e2e-refresh-token',
        user: authUser,
      },
    }),
  );
  await page.route('**/auth/v1/user**', (route) => route.fulfill({ json: authUser }));
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/storage/v1/object/**', (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      });
    }
    mutations.push(method === 'DELETE' ? 'banner-storage-delete' : 'banner-storage-upload');
    return route.fulfill({ json: { Key: `${userId}/banner.png` } });
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/me/profile/stats')) {
      return route.fulfill({
        json: {
          uniqueCardsCount: 7,
          totalCardsCount: 12,
          totalAvailableCardsCount: 20,
          collectionCompletionPercentage: 35,
          decksCount: 2,
          friendsCount: 1,
          gamesPlayed: 4,
          winsCount: 3,
          currentRating: 1200,
          currentRank: 8,
        },
      });
    }
    if (path.endsWith('/me/profile/summary')) {
      return route.fulfill({
        json: {
          collection: {
            totalCopies: 12,
            uniqueVariants: 8,
            uniqueCards: 7,
            publishedCardCount: 20,
            completionRate: 35,
            favoriteRarity: 'Rare',
          },
          deckCount: 2,
          matchCount: 4,
          wins: 3,
          currentRating: 1200,
          currentRank: 8,
          friendsCount: 1,
        },
      });
    }
    if (path.endsWith('/me/profile/banner')) {
      if (request.method() === 'DELETE') {
        currentProfile = { ...currentProfile, bannerUrl: null, bannerPositionY: 50 };
      } else {
        currentProfile = { ...currentProfile, ...request.postDataJSON() };
      }
      mutations.push('profile-banner');
      return route.fulfill({ json: currentProfile });
    }
    if (path.endsWith('/me/profile')) {
      if (request.method() === 'PATCH') {
        currentProfile = { ...currentProfile, ...request.postDataJSON() };
        mutations.push('profile');
      }
      return route.fulfill({ json: currentProfile });
    }
    if (path.endsWith('/me/preferences')) {
      if (request.method() === 'PATCH') {
        preferences = {
          ...preferences,
          ...request.postDataJSON(),
          updatedAt: new Date().toISOString(),
        };
        mutations.push('preferences');
      }
      return route.fulfill({ json: preferences });
    }
    if (path.endsWith('/me/account/security-settings')) {
      return route.fulfill({
        json: {
          email,
          securityEmailsEnabled: true,
          isDeactivated: false,
          deactivatedAt: null,
          deletion: profile.deletion,
        },
      });
    }
    if (path.endsWith('/users/lucas_e2e/public-profile')) {
      return route.fulfill({
        json: {
          username: 'lucas_e2e',
          displayName: 'Lucas E2E',
          avatarUrl: null,
          bannerUrl: 'lucas_e2e/banner.webp',
          bannerPositionY: 62,
          bio: 'Collection publique',
          role: 'PIONEER',
          roleLabel: 'Pionnier',
          isPioneer: true,
          profileVisibility: 'PUBLIC',
          collectionVisibility: 'PUBLIC',
          createdAt: timestamp,
          friendship: { status: 'NONE' },
          permissions: {
            canViewProfile: true,
            canViewStats: true,
            canViewCollection: true,
            canViewQuantities: false,
            canViewCollectionCompletion: true,
            canSendFriendRequest: true,
            canBlock: true,
          },
        },
      });
    }
    if (path.endsWith('/users/friends_only/public-profile')) {
      return route.fulfill({
        json: {
          username: 'friends_only',
          displayName: 'Entre amis',
          avatarUrl: null,
          bannerUrl: null,
          bannerPositionY: 50,
          bio: null,
          role: 'USER',
          roleLabel: 'Utilisateur',
          isPioneer: false,
          profileVisibility: 'PUBLIC',
          collectionVisibility: 'FRIENDS',
          createdAt: timestamp,
          friendship: { status: 'NONE' },
          permissions: {
            canViewProfile: true,
            canViewStats: true,
            canViewCollection: false,
            canViewQuantities: false,
            canViewCollectionCompletion: false,
            canSendFriendRequest: true,
            canBlock: true,
          },
        },
      });
    }
    if (path.endsWith('/users/private_user/public-profile')) {
      return route.fulfill({
        json: {
          username: 'private_user',
          displayName: null,
          avatarUrl: null,
          bannerUrl: null,
          bannerPositionY: 50,
          bio: null,
          role: 'ADMINISTRATOR',
          roleLabel: 'Administrateur',
          isPioneer: false,
          profileVisibility: 'PRIVATE',
          collectionVisibility: 'PRIVATE',
          createdAt: timestamp,
          friendship: { status: 'NONE' },
          permissions: {
            canViewProfile: false,
            canViewStats: false,
            canViewCollection: false,
            canViewQuantities: false,
            canViewCollectionCompletion: false,
            canSendFriendRequest: true,
            canBlock: true,
          },
        },
      });
    }
    if (path.endsWith('/users/moderator_e2e/public-profile')) {
      return route.fulfill({
        json: {
          username: 'moderator_e2e',
          displayName: 'Modération E2E',
          avatarUrl: null,
          bannerUrl: null,
          bannerPositionY: 50,
          bio: null,
          role: 'MODERATOR',
          roleLabel: 'Modérateur',
          isPioneer: false,
          profileVisibility: 'PUBLIC',
          collectionVisibility: 'PUBLIC',
          createdAt: timestamp,
          friendship: { status: 'NONE' },
          permissions: {
            canViewProfile: true,
            canViewStats: true,
            canViewCollection: true,
            canViewQuantities: true,
            canViewCollectionCompletion: true,
            canSendFriendRequest: true,
            canBlock: true,
          },
        },
      });
    }
    if (path.endsWith('/users/lucas_e2e/profile-stats')) {
      return route.fulfill({
        json: {
          friendsCount: 4,
          uniqueCardsCount: 7,
          totalAvailableCardsCount: 20,
          collectionCompletionPercentage: 35,
          decksCount: 2,
          gamesPlayed: 4,
          winsCount: 3,
          currentRating: 1200,
          currentRank: 8,
        },
      });
    }
    if (path.endsWith('/users/friends_only/profile-stats')) {
      return route.fulfill({ json: { friendsCount: 2, decksCount: 1 } });
    }
    if (path.endsWith('/users/moderator_e2e/profile-stats')) {
      return route.fulfill({ json: { friendsCount: 2, decksCount: 1 } });
    }
    if (path.endsWith('/me/collection/seasons/origines')) {
      return route.fulfill({
        json: {
          season: seasonSummary.season,
          collection: seasonSummary.collection,
          cards: {
            data: fullSeasonCollectionItems,
            pagination: {
              page: 1,
              pageSize: 30,
              total: fullSeasonCollectionItems.length,
              pageCount: 1,
            },
          },
        },
      });
    }
    if (path.endsWith('/me/collection/seasons')) {
      return route.fulfill({ json: [seasonSummary, emptySeasonSummary] });
    }
    if (path.endsWith('/users/lucas_e2e/collection/seasons/origines')) {
      return route.fulfill({
        json: {
          season: seasonSummary.season,
          collection: {
            uniqueOwnedCards: 7,
            totalAvailableCards: 20,
            completionPercentage: 35,
          },
          cards: {
            data: fullSeasonCollectionItems.map((item) => ({
              ...item,
              quantity: undefined,
              lockedQuantity: undefined,
              ownedVariants: item.ownedVariants.map(
                ({
                  quantity: _quantity,
                  lockedQuantity: _locked,
                  lastObtainedAt: _date,
                  ...variant
                }) => variant,
              ),
            })),
            pagination: {
              page: 1,
              pageSize: 30,
              total: fullSeasonCollectionItems.length,
              pageCount: 1,
            },
          },
        },
      });
    }
    if (path.endsWith('/users/lucas_e2e/collection/seasons')) {
      return route.fulfill({
        json: [
          {
            ...seasonSummary,
            collection: {
              uniqueOwnedCards: 7,
              totalAvailableCards: 20,
              completionPercentage: 35,
            },
            previewCards: seasonSummary.previewCards.map((item) => ({
              ...item,
              quantity: undefined,
              lockedQuantity: undefined,
            })),
          },
        ],
      });
    }
    if (path.endsWith('/users/moderator_e2e/collection/seasons')) {
      return route.fulfill({ json: [] });
    }
    if (path.endsWith('/users/lucas_e2e/collection')) {
      return route.fulfill({
        json: {
          data: [
            {
              cardVariantId: collectionEntry.cardVariantId,
              variant: collectionEntry.variant,
            },
          ],
          pagination: { page: 1, pageSize: 30, total: 1, pageCount: 1 },
        },
      });
    }
    if (path.endsWith('/me/collection')) {
      return route.fulfill({
        json: {
          data: [collectionEntry],
          pagination: { page: 1, pageSize: 30, total: 1, pageCount: 1 },
        },
      });
    }
    if (path.endsWith(`/me/collection/card/${cardId}`)) {
      return route.fulfill({
        json: { totalQuantity: 3, lockedQuantity: 1, variants: [], decks: [] },
      });
    }
    if (path.endsWith(`/cards/${cardId}`)) {
      return route.fulfill({
        json: {
          ...card,
          effectText: null,
          stats: {},
          effects: [],
          metadata: {},
          variants: [collectionEntry.variant],
        },
      });
    }
    if (path.endsWith('/card-facets')) {
      return route.fulfill({
        json: {
          sets: [],
          rarities: [card.rarity],
          seasons: [card.season],
          types: card.types,
        },
      });
    }
    if (path.endsWith('/me/friends')) return route.fulfill({ json: [] });
    if (path.endsWith('/me/friend-requests/sent')) return route.fulfill({ json: [] });
    if (path.endsWith('/me/friend-requests')) {
      return route.fulfill({
        json: [
          {
            id: requestId,
            status: 'PENDING',
            sender: friend,
            receiver: {
              id: userId,
              username: 'safir_e2e',
              displayName: 'Safir E2E',
              avatarUrl: null,
              role: 'USER',
              roleLabel: 'Utilisateur',
              isPioneer: false,
            },
            createdAt: timestamp,
            updatedAt: timestamp,
            respondedAt: null,
          },
        ],
      });
    }
    if (path.endsWith('/me/blocked-users')) return route.fulfill({ json: [] });
    if (path.endsWith('/users/search')) {
      return route.fulfill({
        json: {
          data: [{ ...friend, profileVisibility: 'PUBLIC', friendshipStatus: 'NONE' }],
          pagination: { page: 1, pageSize: 20, total: 1, pageCount: 1 },
        },
      });
    }
    if (request.method() !== 'GET') {
      mutations.push(path);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Mock absent' } });
  });
  return mutations;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.context().addCookies([
    {
      name: 'safir-e2e-auth',
      value: 'safir-pocket-local-e2e',
      url: new URL(page.url()).origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const form = page.locator('main form');
  await form.locator('input[name="email"]:visible').fill(email);
  await form.locator('input[name="password"]:visible').fill(password);
  await form.locator('button[type="submit"]:visible').click();
  await page.waitForURL(/\/profile$/);
  await expect(
    page.getByRole('button', { name: 'Ouvrir le menu du compte' }).filter({ visible: true }),
  ).toBeVisible();
}

test('profile, avatar menu, preferences and social workflows are connected', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  const mutations = await mockPersonalSpace(page);
  await login(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Safir E2E' })).toBeVisible();
  await expect(page.getByTestId('profile-banner')).toBeVisible();
  await expect(page.getByTestId('profile-banner')).toHaveAttribute(
    'aria-label',
    /bannière par défaut/,
  );
  await expect(page.getByLabel('Rôle : Utilisateur')).toBeVisible();
  await expect(page.getByText('Cartes totales')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Origines' })).toBeVisible();
  await expect(page.getByText('Sentinelle sociale')).toBeVisible();
  await expect(page.getByLabel('Aperçu des cartes de la saison').getByRole('link')).toHaveCount(
    PROFILE_SEASON_PREVIEW_CARD_LIMIT,
  );
  await expect(page.getByText('Aucune carte obtenue pour cette saison.')).toBeVisible();
  await expect(page.getByLabel('Rechercher dans la collection')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Collection', exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Ouvrir le menu du compte' })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole('menuitem', { name: 'Voir mon profil' })).toBeVisible();
  await page.getByRole('menuitem', { name: /Pr.f.rences/ }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);

  await page.getByLabel("Nom d'utilisateur").fill('safir_renamed');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect.poll(() => mutations).toContain('profile');

  const bannerEditor = page.getByTestId('profile-banner-editor');
  await bannerEditor.locator('input[type="file"]').setInputFiles({
    name: 'banner.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await bannerEditor.getByRole('slider').fill('72');
  await bannerEditor.getByRole('button', { name: 'Enregistrer la bannière' }).click();
  await expect.poll(() => mutations).toContain('banner-storage-upload');
  await expect.poll(() => mutations).toContain('profile-banner');
  await expect(bannerEditor.getByRole('slider')).toHaveValue('72');

  await page.getByRole('link', { name: /Confidentialit/ }).click();
  await page.getByRole('switch', { name: 'Profil public' }).click();
  await page.getByLabel('Visibilité de la collection').selectOption('FRIENDS');
  await page.getByRole('switch', { name: 'Afficher les quantités de cartes' }).click();
  await expect.poll(() => mutations).toContain('preferences');

  await page.getByRole('link', { name: 'Amis' }).click();
  await page.getByRole('tab', { name: /Re.ues/ }).click();
  await page.getByRole('button', { name: 'Accepter' }).click();
  await expect.poll(() => mutations.some((path) => path.endsWith('/accept'))).toBe(true);
  await page.getByRole('tab', { name: 'Recherche' }).click();
  await page.getByLabel('Rechercher un joueur').fill('lucas');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByText('Lucas E2E')).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect.poll(() => mutations.some((path) => path.endsWith('/friend-request'))).toBe(true);
  await page.getByRole('button', { name: 'Bloquer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bloquer' }).click();
  await expect.poll(() => mutations.some((path) => path.endsWith('/block'))).toBe(true);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] });
});

test('season preview skeletons and loaded previews are limited to five cards', async ({ page }) => {
  await mockPersonalSpace(page);
  let releaseSeasonSummaries: (() => void) | undefined;
  const seasonSummariesReady = new Promise<void>((resolve) => {
    releaseSeasonSummaries = resolve;
  });
  await page.route('**/api/v1/me/collection/seasons', async (route) => {
    await seasonSummariesReady;
    await route.fulfill({ json: [seasonSummary, emptySeasonSummary] });
  });
  await login(page);

  await expect(page.getByTestId('season-preview-skeleton')).toHaveCount(
    PROFILE_SEASON_PREVIEW_CARD_LIMIT * 3,
  );
  releaseSeasonSummaries?.();
  await expect(page.getByTestId('season-preview-skeleton')).toHaveCount(0);
  await expect(page.getByLabel('Aperçu des cartes de la saison').getByRole('link')).toHaveCount(
    PROFILE_SEASON_PREVIEW_CARD_LIMIT,
  );
});

test('season collection details own the filters, card details and legacy redirect', async ({
  page,
}, testInfo) => {
  await mockPersonalSpace(page);
  await login(page);
  await expect(page.getByLabel('Rechercher dans la collection')).toHaveCount(0);
  await page.getByRole('link', { name: 'Explorer la collection de la saison Origines' }).click();
  await expect(page).toHaveURL(/\/profile\/collection\/origines$/);
  await expect(page.getByRole('heading', { name: 'Origines' })).toBeVisible();
  await expect(page.locator('main a[href^="/cards/"]')).toHaveCount(
    fullSeasonCollectionItems.length,
  );
  if (process.env.E2E_CAPTURE_PROFILE_SCREENSHOTS === 'true') {
    await page.screenshot({
      path: testInfo.outputPath(`profile-season-own-${page.viewportSize()?.width ?? 0}.png`),
      fullPage: true,
    });
  }
  await page.getByLabel('Rechercher dans la collection').fill('sentinelle');
  await expect(page).toHaveURL(/search=sentinelle/);
  const mobileFilters = page.getByRole('button', { name: /^Filtres/ });
  const filtersUseDrawer = await mobileFilters.isVisible();
  let filtersRoot = page.getByTestId('cards-toolbar');
  if (filtersUseDrawer) {
    await mobileFilters.click();
    filtersRoot = page.getByRole('dialog', { name: 'Filtrer la collection' });
  }
  await filtersRoot.getByLabel('Rareté').selectOption('rare');
  await filtersRoot.getByLabel('Type').selectOption('allie');
  await expect(page).toHaveURL(/rarity=rare/);
  await expect(page).toHaveURL(/type=allie/);
  if (filtersUseDrawer) await filtersRoot.getByRole('button', { name: 'Fermer' }).click();
  await page
    .getByRole('link', { name: /Sentinelle sociale/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/cards/${cardId}$`));
  await expect(page.getByRole('heading', { name: 'Sentinelle sociale' })).toBeVisible();

  await page.goto('/profile/collection/origines');
  await page.getByRole('link', { name: 'Retour au profil' }).click();
  await expect(page).toHaveURL(/\/profile#collection$/);

  await page.goto('/collection');
  await expect(page).toHaveURL(/\/profile#collection$/);
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible();
});

test('public profile collection obeys public, friends-only and private access', async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  const mutations = await mockPersonalSpace(page);
  await login(page);

  await page.goto('/users/lucas_e2e');
  await expect(page.getByRole('heading', { name: 'Lucas E2E' })).toBeVisible();
  await expect(page.getByTestId('profile-banner')).toHaveAttribute(
    'style',
    /background-position: center 62%/,
  );
  await expect(page.getByLabel('Rôle : Pionnier')).toBeVisible();
  await expect(page.getByText('Sentinelle sociale')).toBeVisible();
  await expect(page.getByLabel('Aperçu des cartes de la saison').getByRole('link')).toHaveCount(
    PROFILE_SEASON_PREVIEW_CARD_LIMIT,
  );
  await expect(page.getByText('× 3')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajouter en ami' }).click();
  await expect.poll(() => mutations.some((path) => path.includes('/by-username/'))).toBe(true);

  await page.goto('/users/lucas_e2e/collection/origines');
  await expect(page.locator('main a[href^="/cards/"]')).toHaveCount(
    fullSeasonCollectionItems.length,
  );
  if (process.env.E2E_CAPTURE_PROFILE_SCREENSHOTS === 'true') {
    await page.screenshot({
      path: testInfo.outputPath(`profile-season-public-${page.viewportSize()?.width ?? 0}.png`),
      fullPage: true,
    });
  }

  await page.goto('/users/friends_only');
  await expect(
    page.getByText('Cette collection est visible uniquement par ses amis.'),
  ).toBeVisible();
  await expect(page.getByText('Sentinelle sociale')).toHaveCount(0);

  await page.goto('/users/private_user');
  await expect(page.getByText('Ce profil est privé.')).toBeVisible();
  await expect(page.getByLabel('Rôle : Administrateur')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection' })).toHaveCount(0);

  await page.goto('/users/moderator_e2e');
  await expect(page.getByLabel('Rôle : Modérateur')).toBeVisible();
  expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] });
});

test('dangerous account actions require reinforced confirmation', async ({ page }) => {
  const mutations = await mockPersonalSpace(page);
  await login(page);
  await page.goto('/settings/account');
  await page.getByRole('button', { name: 'Désactiver mon compte' }).click();
  const deactivate = page.getByRole('dialog');
  await deactivate.getByLabel('Saisissez votre username').fill('safir_e2e');
  await deactivate.getByLabel('Je comprends les conséquences').check();
  await deactivate.getByRole('button', { name: 'Confirmer la désactivation' }).click();
  await expect.poll(() => mutations.some((path) => path.endsWith('/deactivate'))).toBe(true);
});

test('account deletion is scheduled only after username and checkbox confirmation', async ({
  page,
}) => {
  const mutations = await mockPersonalSpace(page);
  await login(page);
  await page.goto('/settings/account');
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Saisissez votre username').fill('safir_e2e');
  await dialog.getByLabel(/Je demande la suppression/).check();
  await dialog.getByRole('button', { name: 'Programmer la suppression' }).click();
  await expect.poll(() => mutations.some((path) => path.endsWith('/deletion-request'))).toBe(true);
});

test('profiles remain usable at all requested responsive widths', async ({ page }, testInfo) => {
  await mockPersonalSpace(page);
  await login(page);
  for (const width of [375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Safir E2E' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible();
    const ownPreview = page.getByLabel('Aperçu des cartes de la saison');
    await expect(ownPreview.getByRole('link')).toHaveCount(PROFILE_SEASON_PREVIEW_CARD_LIMIT);
    const previewLayout = await ownPreview.evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
      firstColumnWidth: Number.parseFloat(getComputedStyle(element).gridTemplateColumns),
      overflowX: getComputedStyle(element).overflowX,
      scrollable: element.scrollWidth > element.clientWidth,
    }));
    expect(previewLayout.columns).toBe(PROFILE_SEASON_PREVIEW_CARD_LIMIT);
    expect(previewLayout.overflowX).toBe(width < 768 ? 'auto' : 'visible');
    expect(previewLayout.scrollable).toBe(width < 768);
    if (width < 768) expect(previewLayout.firstColumnWidth).toBe(180);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (
      process.env.E2E_CAPTURE_PROFILE_SCREENSHOTS === 'true' &&
      (width === 375 || width === 1280)
    ) {
      await page.screenshot({
        path: testInfo.outputPath(`profile-own-${width}.png`),
        fullPage: true,
      });
    }
    if (width < 768) {
      await ownPreview.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
      await expect
        .poll(() => ownPreview.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
    }
    await page.goto('/users/lucas_e2e');
    await expect(page.getByRole('heading', { name: 'Lucas E2E' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (
      process.env.E2E_CAPTURE_PROFILE_SCREENSHOTS === 'true' &&
      (width === 375 || width === 1280)
    ) {
      await page.screenshot({
        path: testInfo.outputPath(`profile-public-${width}.png`),
        fullPage: true,
      });
    }
  }
});

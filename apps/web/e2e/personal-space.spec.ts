import { expect, test, type Page } from '@playwright/test';

const userId = '11111111-1111-4111-8111-111111111111';
const friendId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
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
  isPioneer: false,
};

async function mockPersonalSpace(page: Page) {
  const mutations: string[] = [];
  let currentProfile = { ...profile };
  let preferences = {
    userId,
    profileVisibility: 'PUBLIC',
    allowFriendRequests: true,
    appearInUserSearch: true,
    showOnlineStatus: false,
    showCollectionStats: true,
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
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/me/profile/stats') || path.endsWith('/me/profile/summary')) {
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
    if (path.endsWith('/me/collection/summary')) {
      return route.fulfill({
        json: {
          totalCopies: 0,
          uniqueVariants: 0,
          uniqueCards: 0,
          publishedCardCount: 0,
          completionRate: 0,
          favoriteRarity: null,
          sets: [],
        },
      });
    }
    if (path.endsWith('/me/collection')) {
      return route.fulfill({
        json: {
          data: [],
          pagination: { page: 1, pageSize: 30, total: 0, pageCount: 0 },
        },
      });
    }
    if (path.endsWith('/card-facets')) {
      return route.fulfill({ json: { sets: [], rarities: [], seasons: [], types: [] } });
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
  await page.waitForURL(/\/collection$/);
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
  await expect(page.getByText('Cartes possédées')).toBeVisible();
  await page
    .getByRole('button', { name: 'Ouvrir le menu du compte' })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole('menuitem', { name: 'Voir mon profil' })).toBeVisible();
  await page.getByRole('menuitem', { name: /Pr.f.rences/ }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);

  await page.getByLabel("Nom d'utilisateur").fill('safir_renamed');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect.poll(() => mutations).toContain('profile');

  await page.getByRole('link', { name: /Confidentialit/ }).click();
  await page.getByRole('switch', { name: 'Profil public' }).click();
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

test('settings remain usable at all requested responsive widths', async ({ page }) => {
  await mockPersonalSpace(page);
  await login(page);
  for (const width of [375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings/friends');
    await expect(page.getByRole('heading', { name: 'Préférences' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

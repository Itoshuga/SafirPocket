import { expect, test, type Page } from '@playwright/test';
import type { CardSeason } from '@safir/shared-types';

test('signup validates identity fields and sends only Auth credentials plus username metadata', async ({
  page,
}) => {
  let signupBody: Record<string, unknown> | null = null;
  await page.route('**/api/v1/auth/username-availability**', (route) =>
    route.fulfill({
      json: { username: 'amina_7', normalizedUsername: 'amina_7', available: true },
    }),
  );
  await page.route('**/auth/v1/signup**', async (route) => {
    signupBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 400,
      json: { code: 'signup_disabled', msg: 'Inscription simulée pour le test.' },
    });
  });

  await page.goto('/login');
  await page.getByRole('tab', { name: 'Inscription' }).click();
  await page.getByLabel(/Nom d.*utilisateur/).fill('ab');
  await page.getByLabel('E-mail').fill('amina@example.com');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mot-de-passe-solide');
  await page.getByLabel('Confirmer le mot de passe').fill('autre-mot-de-passe');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText(/3 caractères/)).toBeVisible();
  await expect(page.getByText('Les mots de passe ne correspondent pas.')).toBeVisible();

  await page.getByLabel(/Nom d.*utilisateur/).fill('amina_7');
  await page.getByLabel('Confirmer le mot de passe').fill('mot-de-passe-solide');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect.poll(() => signupBody).not.toBeNull();
  expect(signupBody).toMatchObject({
    email: 'amina@example.com',
    password: 'mot-de-passe-solide',
    data: { username: 'amina_7' },
  });
  expect(signupBody).not.toHaveProperty('confirmPassword');
  await expect(page.getByText('Inscription simulée pour le test.')).toBeVisible();
});

const e2eEmail = process.env.E2E_AUTH_EMAIL ?? 'admin-e2e@example.com';
const e2ePassword = process.env.E2E_AUTH_PASSWORD ?? 'E2E-password-only!';

const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const rarityId = '33333333-3333-4333-8333-333333333333';
const seasonId = '44444444-4444-4444-8444-444444444444';
const typeId = '55555555-5555-4555-8555-555555555555';
const cardId = '66666666-6666-4666-8666-666666666666';
const timestamp = '2026-07-17T12:00:00.000Z';

const profile = {
  id: actorId,
  username: 'moderatrice',
  normalizedUsername: 'moderatrice',
  email: e2eEmail,
  displayName: 'Modératrice',
  avatarUrl: null,
  bio: null,
  role: 'ADMINISTRATOR',
  roleLabel: 'Administrateur',
  status: 'ACTIVE',
  statusLabel: 'Actif',
  suspendedUntil: null,
  mustChangePassword: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: timestamp,
};

const authUser = {
  id: actorId,
  aud: 'authenticated',
  role: 'authenticated',
  email: e2eEmail,
  email_confirmed_at: timestamp,
  phone: '',
  confirmed_at: timestamp,
  last_sign_in_at: timestamp,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: timestamp,
  updated_at: timestamp,
  is_anonymous: false,
};

const e2eAccessToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(
    JSON.stringify({
      sub: actorId,
      aud: 'authenticated',
      role: 'authenticated',
      email: e2eEmail,
      exp: 4_102_444_800,
    }),
  ).toString('base64url'),
  'e2e-signature',
].join('.');

const rarity = {
  id: rarityId,
  name: 'Rare',
  slug: 'rare',
  description: null,
  displayColor: '#9A6700',
  sortOrder: 1,
  isActive: true,
  cardCount: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
const season = {
  id: seasonId,
  name: 'Origines',
  slug: 'origines',
  code: 'ORI',
  description: null,
  startDate: null,
  endDate: null,
  sortOrder: 1,
  isActive: true,
  cardCount: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
const cardType = {
  id: typeId,
  name: 'Allié',
  slug: 'allie',
  description: null,
  displayColor: '#1F5FC4',
  sortOrder: 1,
  isActive: true,
  cardCount: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
const adminCard = {
  id: cardId,
  setId: null,
  name: 'Sentinelle E2E',
  slug: 'sentinelle-e2e-7',
  number: 7,
  collectionNumber: '7',
  attack: 3,
  defense: 4,
  value: 2,
  description: null,
  imageUrl: null,
  artworkPath: null,
  isCommander: false,
  rarity,
  season,
  types: [cardType],
  cardType: 'Allié',
  cost: 2,
  status: 'published',
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};

async function mockSupabaseAuth(page: Page) {
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      json: {
        access_token: e2eAccessToken,
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
}

async function mockAdminApi(page: Page, actorProfile = profile) {
  await mockSupabaseAuth(page);
  const mutations: Array<{ method: string; path: string; body: unknown }> = [];
  let createdSeason: CardSeason | null = null;
  let targetStatus: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE';
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/me/profile')) return route.fulfill({ json: actorProfile });
    if (path.endsWith('/me/account/security-settings')) {
      return route.fulfill({
        json: {
          email: actorProfile.email,
          securityEmailsEnabled: true,
          isDeactivated: false,
          deactivatedAt: null,
          deletion: {
            state: 'NONE',
            requestedAt: null,
            scheduledFor: null,
            cancelledAt: null,
            processedAt: null,
          },
        },
      });
    }
    if (path.endsWith('/me/collection/summary')) {
      return route.fulfill({
        json: {
          totalCopies: 0,
          uniqueVariants: 0,
          uniqueCards: 0,
          completionRate: 0,
          publishedCardCount: 0,
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
    if (path.endsWith('/admin/overview')) {
      return route.fulfill({
        json: {
          counts: {
            totalUsers: 2,
            activeUsers: 2,
            suspendedUsers: 0,
            bannedUsers: 0,
            pioneers: 0,
            cards: 1,
            rarities: 1,
            seasons: 1,
            types: 1,
          },
          recentActions: [],
        },
      });
    }
    if (path.endsWith(`/admin/users/${targetId}/profile`) && request.method() === 'PATCH') {
      mutations.push({ method: request.method(), path, body: request.postDataJSON() });
      return route.fulfill({ json: { ...profile, ...request.postDataJSON(), id: targetId } });
    }
    if (path.includes(`/admin/users/${targetId}/warnings`)) {
      if (request.method() === 'POST') {
        mutations.push({ method: request.method(), path, body: request.postDataJSON() });
        return route.fulfill({
          json: {
            id: '77777777-7777-4777-8777-777777777777',
            userId: targetId,
            issuedByUserId: actorId,
            reason: 'Rappel des règles',
            internalNote: null,
            severity: 'LOW',
            severityLabel: 'Faible',
            isActive: true,
            acknowledgedAt: null,
            revokedAt: null,
            revokedByUserId: null,
            createdAt: timestamp,
            updatedAt: timestamp,
            issuedBy: { id: actorId, username: 'moderatrice', displayName: 'Modératrice' },
          },
        });
      }
      return route.fulfill({ json: [] });
    }
    if (
      path.endsWith(`/admin/users/${targetId}/moderation-history`) ||
      path.endsWith(`/admin/users/${targetId}/audit-logs`)
    ) {
      return route.fulfill({ json: [] });
    }
    if (
      path.endsWith(`/admin/users/${targetId}/suspend`) ||
      path.endsWith(`/admin/users/${targetId}/unsuspend`) ||
      path.endsWith(`/admin/users/${targetId}/ban`) ||
      path.endsWith(`/admin/users/${targetId}/unban`) ||
      path.endsWith(`/admin/users/${targetId}/password-reset-email`) ||
      path.endsWith(`/admin/users/${targetId}/temporary-password`) ||
      path.endsWith(`/admin/users/${targetId}/email`) ||
      path.endsWith(`/admin/users/${targetId}/role`)
    ) {
      mutations.push({
        method: request.method(),
        path,
        body: request.postData() ? request.postDataJSON() : null,
      });
      if (path.endsWith('/suspend')) targetStatus = 'SUSPENDED';
      if (path.endsWith('/unsuspend')) targetStatus = 'ACTIVE';
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith(`/admin/users/${targetId}`)) {
      return route.fulfill({
        json: {
          ...profile,
          id: targetId,
          username: 'cible',
          normalizedUsername: 'cible',
          email: 'cible@example.com',
          displayName: 'Cible',
          role: 'USER',
          roleLabel: 'Utilisateur',
          status: targetStatus,
          statusLabel: targetStatus === 'SUSPENDED' ? 'Suspendu' : 'Actif',
          suspendedUntil: targetStatus === 'SUSPENDED' ? '2026-07-24T12:00:00.000Z' : null,
          mustChangePassword: false,
          activeWarningsCount: 0,
          totalWarningsCount: 0,
          latestModerationActions: [],
        },
      });
    }
    if (path.endsWith('/admin/users')) {
      return route.fulfill({
        json: {
          data: [
            {
              ...profile,
              id: targetId,
              username: 'cible',
              email: 'cible@example.com',
              displayName: 'Cible',
              role: 'USER',
              roleLabel: 'Utilisateur',
            },
          ],
          pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
        },
      });
    }
    if (path.endsWith(`/admin/cards/${cardId}`)) return route.fulfill({ json: adminCard });
    if (path.endsWith('/admin/cards')) {
      if (request.method() === 'POST') return route.fulfill({ json: adminCard });
      return route.fulfill({
        json: {
          data: [adminCard],
          pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
        },
      });
    }
    if (path.endsWith('/card-facets')) {
      return route.fulfill({
        json: { sets: [], rarities: [rarity], seasons: [season], types: [cardType] },
      });
    }
    if (path.endsWith('/admin/rarities')) {
      return route.fulfill({ json: request.method() === 'POST' ? rarity : [rarity] });
    }
    if (path.endsWith('/admin/seasons')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        mutations.push({ method: request.method(), path, body });
        createdSeason = {
          ...season,
          id: '88888888-8888-4888-8888-888888888888',
          name: String(body.name),
          slug: String(body.slug),
          code: body.code ? String(body.code) : null,
          description: body.description ? String(body.description) : null,
          startDate: body.startDate ? String(body.startDate) : null,
          endDate: body.endDate ? String(body.endDate) : null,
          sortOrder: Number(body.sortOrder),
          isActive: Boolean(body.isActive),
        };
        return route.fulfill({ json: createdSeason });
      }
      return route.fulfill({ json: createdSeason ? [createdSeason, season] : [season] });
    }
    if (path.endsWith('/admin/card-types')) {
      return route.fulfill({ json: request.method() === 'POST' ? cardType : [cardType] });
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
  const loginForm = page.locator('main form');
  await expect(loginForm).toHaveCount(1);
  const emailInput = loginForm.locator('input[name="email"]:visible');
  const passwordInput = loginForm.locator('input[name="password"]:visible');
  await expect(emailInput).toHaveCount(1);
  await expect(passwordInput).toHaveCount(1);
  await emailInput.fill(e2eEmail);
  await passwordInput.fill(e2ePassword);
  await loginForm.locator('button[type="submit"]:visible').click();
  await page.waitForURL(/\/(collection|admin)/, { timeout: 30_000 });
}

function usesMobileNavigation(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 1024;
}

async function openAdministrationNavigation(page: Page) {
  const mobile = usesMobileNavigation(page);
  if (mobile) await page.getByRole('button', { name: 'Ouvrir la navigation' }).click();
  const toggle = page.getByRole('button', { name: 'Administration' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  return page.locator(
    mobile ? '#mobile-administration-navigation' : '#desktop-administration-navigation',
  );
}

test.describe('authenticated administration workflows', () => {
  test('navigates users, opens details and completes the card form', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    const mutations = await mockAdminApi(page);
    await login(page);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();

    let administration = await openAdministrationNavigation(page);
    await administration.getByRole('link', { name: 'Saisons' }).click();
    await page.getByRole('button', { name: 'Ajouter' }).click();
    const seasonDialog = page.getByRole('dialog');
    await seasonDialog.getByLabel('Nom').fill('Horizon E2E');
    await expect(seasonDialog.getByLabel('Slug')).toHaveValue('horizon-e2e');
    await seasonDialog.getByLabel('Code').fill('HE2E');
    await seasonDialog.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText('La saison a été créée.')).toBeVisible();
    await expect(seasonDialog).toHaveCount(0);
    if (usesMobileNavigation(page)) {
      await expect(page.getByRole('button', { name: /Horizon E2E/ })).toBeVisible();
    } else {
      await expect(page.getByRole('cell', { name: 'Horizon E2E', exact: true })).toBeVisible();
    }
    await expect
      .poll(() =>
        mutations.some(({ path, method }) => path.endsWith('/seasons') && method === 'POST'),
      )
      .toBe(true);

    administration = await openAdministrationNavigation(page);
    await administration.getByRole('link', { name: 'Utilisateurs' }).click();
    await page.getByLabel('Rechercher un utilisateur').fill('cible');
    const targetLink = page.getByRole('link', { name: /Cible/ });
    await expect(targetLink).toBeVisible();
    await targetLink.click();
    await expect(page).toHaveURL(new RegExp(`/admin/users/${targetId}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'cible' })).toBeVisible();

    await page.getByRole('tab', { name: 'Profil' }).click();
    await page.getByLabel("Nom d'utilisateur").fill('cible_renommee');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => mutations.some(({ path }) => path.endsWith('/profile'))).toBe(true);

    await page.getByRole('tab', { name: 'Modération' }).click();
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await page.getByRole('dialog').getByLabel('Raison').fill('Rappel des règles');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect.poll(() => mutations.some(({ path }) => path.endsWith('/warnings'))).toBe(true);

    await page.getByRole('button', { name: 'Suspendre' }).click();
    await page.getByRole('dialog').getByLabel('Raison').fill('Suspension temporaire');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect.poll(() => mutations.some(({ path }) => path.endsWith('/suspend'))).toBe(true);
    await page.getByRole('button', { name: 'Lever la suspension' }).click();
    await page.getByRole('dialog').getByLabel('Raison').fill('Fin de la suspension');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect.poll(() => mutations.some(({ path }) => path.endsWith('/unsuspend'))).toBe(true);

    await page.getByRole('tab', { name: 'Sécurité' }).click();
    await page.getByRole('button', { name: 'Envoyer un lien de réinitialisation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect
      .poll(() => mutations.some(({ path }) => path.endsWith('/password-reset-email')))
      .toBe(true);

    await page.goto('/admin/cards/new');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByLabel('Nom')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Nom').fill('Sentinelle E2E');
    await page.getByLabel('Numéro').fill('7');
    await page.getByLabel('Attaque').fill('3');
    await page.getByLabel('Défense').fill('4');
    await page.getByLabel('Valeur').fill('2');
    await page.getByLabel('Rareté').selectOption(rarityId);
    await page.getByLabel('Saison').selectOption(seasonId);
    await page.getByLabel('Allié').check();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/cards/${cardId}$`));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] });
  });

  for (const actorRole of ['USER', 'PIONEER', 'MODERATOR', 'ADMINISTRATOR'] as const) {
    test(`${actorRole} receives the expected administration navigation`, async ({ page }) => {
      const roleLabel = {
        USER: 'Utilisateur',
        PIONEER: 'Pionnier',
        MODERATOR: 'Modérateur',
        ADMINISTRATOR: 'Administrateur',
      }[actorRole];
      await mockAdminApi(page, { ...profile, role: actorRole, roleLabel });
      await login(page);
      await page.goto('/');
      if (usesMobileNavigation(page)) {
        await page.getByRole('button', { name: 'Ouvrir la navigation' }).click();
      }

      const toggle = page.getByRole('button', { name: 'Administration' });
      if (actorRole === 'USER' || actorRole === 'PIONEER') {
        await expect(toggle).toHaveCount(0);
        return;
      }

      await expect(toggle).toBeVisible();
      await toggle.click();
      const administration = page.locator(
        usesMobileNavigation(page)
          ? '#mobile-administration-navigation'
          : '#desktop-administration-navigation',
      );
      await expect(administration.getByRole('link', { name: 'Vue d’ensemble' })).toBeVisible();
      await expect(administration.getByRole('link', { name: 'Utilisateurs' })).toBeVisible();
      await expect(administration.getByRole('link', { name: 'Cartes', exact: true })).toBeVisible();
      await expect(administration.getByRole('link', { name: 'Journaux' })).toHaveCount(
        actorRole === 'ADMINISTRATOR' ? 1 : 0,
      );
    });
  }

  test('keeps the group open and the precise item active across admin routes', async ({ page }) => {
    await mockAdminApi(page);
    await login(page);
    await page.goto('/admin/cards/new');

    const administration = await openAdministrationNavigation(page);
    await expect(page.getByRole('button', { name: 'Administration' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(administration.getByRole('link', { name: 'Cartes', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(administration.getByRole('link', { name: 'Vue d’ensemble' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('navigation', { name: 'Sections d’administration' })).toHaveCount(
      0,
    );

    await administration.getByRole('link', { name: 'Utilisateurs' }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    if (usesMobileNavigation(page)) {
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } else {
      await expect(administration.getByRole('link', { name: 'Utilisateurs' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('opens rarity, season and type creation drawers on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAdminApi(page);
    await login(page);
    for (const [path, title] of [
      ['/admin/rarities', 'Raretés'],
      ['/admin/seasons', 'Saisons'],
      ['/admin/types', 'Types'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await page.getByRole('button', { name: 'Ajouter' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  });
});

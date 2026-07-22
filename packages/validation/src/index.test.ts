import { describe, expect, it } from 'vitest';
import {
  createCardSchema,
  createSeasonSchema,
  deckCardSchema,
  matchActionIntentSchema,
  normalizeUsername,
  signupSchema,
  temporaryPasswordSchema,
  usernameSchema,
  warningCreateSchema,
  profileUpdateSchema,
  profileStatsSchema,
  userPreferencesUpdateSchema,
  userSearchQuerySchema,
  accountDeletionRequestSchema,
  accountPasswordUpdateSchema,
  createBoosterSchema,
  cardExportOptionsSchema,
  cardImportPreviewOptionsSchema,
  safirCardImportItemSchema,
  cardFiltersSchema,
  collectionFiltersSchema,
} from './index.js';

describe('shared validation', () => {
  it('parses shared catalogue filters without coercing false to true', () => {
    expect(
      cardFiltersSchema.parse({
        season: 'origines',
        type: 'allie',
        isCommander: 'false',
        sort: 'season',
      }),
    ).toMatchObject({
      season: 'origines',
      type: 'allie',
      isCommander: false,
      sort: 'season',
    });
  });

  it('keeps collection-only sorts out of the public catalogue contract', () => {
    expect(collectionFiltersSchema.safeParse({ sort: '-quantity' }).success).toBe(true);
    expect(cardFiltersSchema.safeParse({ sort: '-quantity' }).success).toBe(false);
    expect(cardFiltersSchema.safeParse({ isCommander: 'yes' }).success).toBe(false);
  });

  it('validates complete and privacy-filtered profile statistics', () => {
    expect(
      profileStatsSchema.safeParse({
        collection: {
          uniqueCardsCount: 142,
          totalCopiesCount: 387,
          totalAvailableCardsCount: 248,
          missingCardsCount: 106,
          completionPercentage: 57.3,
        },
        social: { friendsCount: 24 },
        decks: { totalCount: 6 },
        game: {
          gamesPlayed: 48,
          winsCount: 31,
          lossesCount: 17,
          winRatePercentage: 64.6,
          currentRating: 1200,
          currentRank: 8,
        },
        visibility: {
          canViewCollectionStats: true,
          canViewGameStats: true,
          canViewFriendsCount: true,
        },
      }).success,
    ).toBe(true);
    expect(
      profileStatsSchema.safeParse({
        social: { friendsCount: 2 },
        decks: { totalCount: 1, publicCount: 1 },
        visibility: {
          canViewCollectionStats: false,
          canViewGameStats: false,
          canViewFriendsCount: true,
        },
      }).success,
    ).toBe(true);
    expect(
      profileStatsSchema.safeParse({
        collection: { uniqueCardsCount: 1, completionPercentage: 101 },
        visibility: {
          canViewCollectionStats: true,
          canViewGameStats: false,
          canViewFriendsCount: true,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects invalid deck quantities', () => {
    expect(
      deckCardSchema.safeParse({ cardVariantId: crypto.randomUUID(), quantity: 0 }).success,
    ).toBe(false);
  });

  it('rejects client-computed match results', () => {
    expect(
      matchActionIntentSchema.safeParse({
        actionId: crypto.randomUUID(),
        matchId: crypto.randomUUID(),
        expectedSequence: 0,
        type: 'DECLARE_VICTORY',
        payload: { winnerId: crypto.randomUUID() },
      }).success,
    ).toBe(false);
  });

  it.each(['lu', 'Lucas Safir', '-lucas', 'lucas-', 'lucas@71'])(
    'rejects an invalid username: %s',
    (username) => expect(usernameSchema.safeParse(username).success).toBe(false),
  );

  it('normalizes usernames without changing their display value', () => {
    expect(usernameSchema.parse('Lucas_71')).toBe('Lucas_71');
    expect(normalizeUsername(' Lucas_71 ')).toBe('lucas_71');
  });

  it('requires matching passwords during signup', () => {
    expect(
      signupSchema.safeParse({
        username: 'lucas',
        email: 'lucas@example.com',
        password: 'correct-password',
        confirmPassword: 'different-password',
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate card types and non-HTTPS artwork URLs', () => {
    const typeId = crypto.randomUUID();
    const result = createCardSchema.safeParse({
      name: 'Carte',
      number: 1,
      attack: 1,
      defense: 1,
      value: 1,
      imageUrl: 'http://example.com/card.png',
      isCommander: false,
      rarityId: crypto.randomUUID(),
      seasonId: crypto.randomUUID(),
      typeIds: [typeId, typeId],
      isActive: true,
    });
    expect(result.success).toBe(false);
  });

  it('reuses card constraints for imported cards', () => {
    const imported = {
      name: 'Carte importée',
      number: -1,
      attack: 'inconnue',
      defense: 1,
      value: 1,
      imageUrl: 'http://example.com/card.png',
      isCommander: false,
      rarity: { slug: 'rare' },
      season: { slug: 'origines' },
      types: [{ slug: 'creature' }, { slug: 'creature' }],
      metadata: [],
    };
    expect(safirCardImportItemSchema.safeParse(imported).success).toBe(false);
  });

  it('rejects invalid import modes and incomplete selected exports', () => {
    expect(
      cardImportPreviewOptionsSchema.safeParse({
        format: 'JSON',
        mode: 'REPLACE_ALL',
        conflictBehavior: 'ERROR',
        createMissingRelations: false,
      }).success,
    ).toBe(false);
    expect(
      cardExportOptionsSchema.safeParse({
        format: 'CSV',
        scope: 'SELECTED',
        includeArchived: false,
        includeTechnicalMetadata: false,
      }).success,
    ).toBe(false);
  });

  it('normalizes empty optional season fields and rejects reversed dates', () => {
    const valid = createSeasonSchema.parse({
      name: 'Origines',
      slug: 'origines',
      code: '',
      description: '',
      startDate: '',
      endDate: '',
      sortOrder: '2',
      isActive: true,
    });
    expect(valid).toMatchObject({
      code: null,
      description: null,
      startDate: null,
      endDate: null,
      sortOrder: 2,
    });
    expect(
      createSeasonSchema.safeParse({
        name: 'Futur',
        slug: 'futur',
        startDate: '2026-08-02',
        endDate: '2026-08-01',
      }).success,
    ).toBe(false);
  });

  it('requires strong temporary passwords and validates warning severity', () => {
    expect(
      temporaryPasswordSchema.safeParse({
        temporaryPassword: 'weak-password',
        confirmationUsername: 'target_user',
      }).success,
    ).toBe(false);
    expect(
      warningCreateSchema.safeParse({ reason: 'Rappel des règles', severity: 'CRITICAL' }).success,
    ).toBe(false);
  });

  it('limits biographies and validates persisted privacy preferences', () => {
    expect(profileUpdateSchema.safeParse({ bio: 'x'.repeat(301) }).success).toBe(false);
    expect(userPreferencesUpdateSchema.safeParse({ profileVisibility: 'PRIVATE' }).success).toBe(
      true,
    );
    expect(userPreferencesUpdateSchema.safeParse({}).success).toBe(false);
    expect(userPreferencesUpdateSchema.safeParse({ collectionVisibility: 'FRIENDS' }).success).toBe(
      true,
    );
    expect(
      userPreferencesUpdateSchema.safeParse({ collectionVisibility: 'FOLLOWERS' }).success,
    ).toBe(false);
    expect(userPreferencesUpdateSchema.safeParse({ showCardQuantities: false }).success).toBe(true);
  });

  it('bounds user search pagination against mass enumeration', () => {
    expect(userSearchQuerySchema.safeParse({ query: 'l', pageSize: 20 }).success).toBe(false);
    expect(userSearchQuerySchema.safeParse({ query: 'lucas', pageSize: 500 }).success).toBe(false);
  });

  it('requires strong confirmation for password and deletion actions', () => {
    expect(
      accountPasswordUpdateSchema.safeParse({
        password: 'Secure-password-42!',
        confirmPassword: 'different',
        reauthenticationNonce: '123456',
      }).success,
    ).toBe(false);
    expect(
      accountDeletionRequestSchema.safeParse({
        confirmationUsername: 'lucas',
        confirmed: false,
        reason: null,
      }).success,
    ).toBe(false);
  });

  it('accepts only complete integer booster rates totaling 10,000 basis points', () => {
    const commonId = crypto.randomUUID();
    const base = {
      name: 'Booster Origines',
      slug: 'booster-origines',
      seasonId: crypto.randomUUID(),
      guaranteedCommonRarityId: commonId,
      costAmount: 0,
      currencyCode: null,
      sortOrder: 0,
      isActive: false,
    };
    expect(
      createBoosterSchema.safeParse({
        ...base,
        dropRates: [
          { rarityId: crypto.randomUUID(), dropRateBps: 7000, sortOrder: 0 },
          { rarityId: crypto.randomUUID(), dropRateBps: 3000, sortOrder: 1 },
        ],
      }).success,
    ).toBe(true);
    expect(
      createBoosterSchema.safeParse({
        ...base,
        dropRates: [{ rarityId: crypto.randomUUID(), dropRateBps: 9999, sortOrder: 0 }],
      }).success,
    ).toBe(false);
    expect(
      createBoosterSchema.safeParse({
        ...base,
        dropRates: [{ rarityId: commonId, dropRateBps: 10_000, sortOrder: 0 }],
      }).success,
    ).toBe(false);
  });
});

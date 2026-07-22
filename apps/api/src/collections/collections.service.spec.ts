import { PROFILE_SEASON_PREVIEW_CARD_LIMIT } from '@safir/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { CollectionsService } from './collections.service.js';

const fixedNow = new Date('2026-07-21T10:00:00.000Z');

function seasonCard(id: string, number: number, rarityName = 'Rare') {
  return {
    id,
    setId: null,
    seasonId: 'season-a',
    rarityId: `rarity-${rarityName.toLowerCase()}`,
    name: `Carte ${number}`,
    slug: `carte-${number}`,
    number,
    collectionNumber: String(number),
    attack: 2,
    defense: 3,
    value: 1,
    description: null,
    imageUrl: null,
    artworkPath: null,
    isCommander: false,
    cost: 1,
    status: 'published',
    isActive: true,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    deletedAt: null,
    rarity: {
      id: `rarity-${rarityName.toLowerCase()}`,
      name: rarityName,
      slug: rarityName.toLowerCase(),
      displayColor: null,
    },
    season: { id: 'season-a', name: 'Origines', slug: 'origines', code: 'ORI' },
    typeLinks: [],
    set: null,
  };
}

function ownedPreviewCard({
  cardId,
  number,
  variants,
  rarityName = 'Rare',
}: {
  cardId: string;
  number: number;
  variants: Array<{ id: string; quantity: number }>;
  rarityName?: string;
}) {
  return {
    ...seasonCard(cardId, number, rarityName),
    variants: variants.map(({ id, quantity }, displayOrder) => ({
      id,
      name: id.includes('foil') ? 'Foil' : 'Standard',
      finish: id.includes('foil') ? 'foil' : 'standard',
      artworkPath: null,
      displayOrder,
      userCards: [{ quantity, lockedQuantity: 0, lastObtainedAt: fixedNow }],
    })),
  };
}

function seasonOwnershipRow(cardId: string, quantity: number, seasonId = 'season-a') {
  return {
    quantity,
    cardVariant: { cardId, card: { seasonId } },
  };
}

describe('CollectionsService', () => {
  it('calculates collection aggregates from authoritative ownership rows', async () => {
    const prisma = {
      userCard: {
        findMany: vi.fn().mockResolvedValue([
          {
            quantity: 3,
            cardVariant: {
              cardId: 'card-a',
              card: { legacyRarity: 'Rare', setId: 'set-a' },
            },
          },
          {
            quantity: 2,
            cardVariant: {
              cardId: 'card-a',
              card: { legacyRarity: 'Rare', setId: 'set-a' },
            },
          },
          {
            quantity: 1,
            cardVariant: {
              cardId: 'card-b',
              card: { legacyRarity: 'Common', setId: 'set-a' },
            },
          },
        ]),
      },
      cardSet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'set-a',
            name: 'Alpha',
            slug: 'alpha',
            code: 'ALP',
            _count: { cards: 8 },
          },
        ]),
      },
    };
    const service = new CollectionsService(prisma as never, {} as never);
    await expect(service.summary(crypto.randomUUID())).resolves.toEqual({
      totalCopies: 6,
      uniqueVariants: 3,
      uniqueCards: 2,
      publishedCardCount: 8,
      completionRate: 25,
      favoriteRarity: 'Rare',
      sets: [
        {
          id: 'set-a',
          name: 'Alpha',
          slug: 'alpha',
          code: 'ALP',
          ownedCards: 2,
          cardCount: 8,
          missingCards: 6,
          completionRate: 25,
        },
      ],
    });
  });

  it('applies owned-card filters and paginates server-side', async () => {
    const prisma = {
      userCard: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    };
    const service = new CollectionsService(prisma as never, {} as never);
    await service.list(crypto.randomUUID(), {
      page: 2,
      pageSize: 10,
      sort: 'name',
      search: 'safir',
      season: 'alpha',
      rarity: 'Rare',
      type: 'allie',
      isCommander: false,
    });
    expect(prisma.userCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          cardVariant: {
            card: expect.objectContaining({
              rarity: { slug: 'Rare' },
              season: { slug: 'alpha' },
              typeLinks: { some: { type: { slug: 'allie' } } },
              isCommander: false,
              isActive: true,
              deletedAt: null,
            }),
          },
        }),
      }),
    );
  });

  it('returns a public collection without quantities or locked ownership data', async () => {
    const now = new Date('2026-07-21T10:00:00.000Z');
    const row = {
      userId: crypto.randomUUID(),
      cardVariantId: 'variant-a',
      quantity: 4,
      lockedQuantity: 2,
      firstObtainedAt: now,
      lastObtainedAt: now,
      cardVariant: {
        id: 'variant-a',
        cardId: 'card-a',
        name: 'Standard',
        slug: 'standard',
        finish: 'standard',
        artworkPath: null,
        displayOrder: 0,
        createdAt: now,
        updatedAt: now,
        card: {
          id: 'card-a',
          setId: null,
          name: 'Carte A',
          slug: 'carte-a',
          number: 1,
          collectionNumber: '1',
          attack: 1,
          defense: 1,
          value: 1,
          description: null,
          imageUrl: null,
          artworkPath: null,
          isCommander: false,
          cost: 1,
          status: 'published',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          rarity: { id: 'rarity', name: 'Rare', slug: 'rare', displayColor: null },
          season: { id: 'season', name: 'Origines', slug: 'origines', code: 'ORI' },
          typeLinks: [],
          set: null,
        },
      },
    };
    const prisma = {
      userCard: {
        findMany: vi.fn().mockResolvedValue([row]),
        count: vi.fn().mockResolvedValue(1),
      },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    };
    const access = {
      resolve: vi.fn().mockResolvedValue({
        profile: { id: row.userId },
        preferences: { collectionVisibility: 'PUBLIC' },
        permissions: { canViewCollection: true, canViewQuantities: false },
      }),
    };
    const result = await new CollectionsService(prisma as never, access as never).publicList(
      'lucas',
      undefined,
      { page: 1, pageSize: 30, sort: '-quantity' },
    );
    expect(result.data[0]).not.toHaveProperty('quantity');
    expect(result.data[0]).not.toHaveProperty('lockedQuantity');
    expect(prisma.userCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ cardVariant: { card: { number: 'asc' } } }, { lastObtainedAt: 'desc' }],
      }),
    );
  });

  it('groups owned variants into deterministic season summaries and keeps empty seasons for the owner', async () => {
    const seasons = [
      {
        id: 'season-a',
        name: 'Origines',
        slug: 'origines',
        code: 'ORI',
        sortOrder: 1,
        _count: { cards: 4 },
        boosters: [{ imageUrl: 'boosters/origines.webp' }],
        cards: [
          ownedPreviewCard({
            cardId: 'card-rare',
            number: 8,
            variants: [
              { id: 'variant-standard', quantity: 2 },
              { id: 'variant-foil', quantity: 3 },
            ],
          }),
          ownedPreviewCard({
            cardId: 'card-common',
            number: 1,
            variants: [{ id: 'variant-common', quantity: 1 }],
            rarityName: 'Common',
          }),
        ],
      },
      {
        id: 'season-b',
        name: 'Héritage',
        slug: 'heritage',
        code: 'HER',
        sortOrder: 2,
        _count: { cards: 3 },
        boosters: [],
        cards: [],
      },
    ];
    const rows = [
      seasonOwnershipRow('card-rare', 2),
      seasonOwnershipRow('card-rare', 3),
      seasonOwnershipRow('card-common', 1),
    ];
    const prisma = {
      cardSeason: { findMany: vi.fn().mockResolvedValue(seasons) },
      userCard: { findMany: vi.fn().mockResolvedValue(rows) },
    };

    const result = await new CollectionsService(prisma as never, {} as never).seasonSummaries(
      crypto.randomUUID(),
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      season: { slug: 'origines', imageUrl: 'boosters/origines.webp', sortOrder: 1 },
      collection: {
        uniqueOwnedCards: 2,
        totalAvailableCards: 4,
        totalCopies: 6,
        completionPercentage: 50,
      },
    });
    expect(result[0]?.previewCards.map(({ card }) => card.id)).toEqual([
      'card-rare',
      'card-common',
    ]);
    expect(result[0]?.previewCards[0]?.ownedVariants).toHaveLength(2);
    expect(result[1]).toMatchObject({
      season: { slug: 'heritage', imageUrl: null },
      collection: { uniqueOwnedCards: 0, totalCopies: 0, completionPercentage: 0 },
      previewCards: [],
    });
    expect(prisma.cardSeason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }, { name: 'asc' }],
        select: expect.objectContaining({
          cards: expect.objectContaining({
            take: PROFILE_SEASON_PREVIEW_CARD_LIMIT,
            orderBy: [{ rarity: { sortOrder: 'desc' } }, { number: 'asc' }, { id: 'asc' }],
          }),
        }),
      }),
    );
    expect(prisma.userCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          quantity: true,
          cardVariant: { select: { cardId: true, card: { select: { seasonId: true } } } },
        },
      }),
    );
  });

  it.each([
    { ownedCards: 8, expectedPreviewCards: 5 },
    { ownedCards: 4, expectedPreviewCards: 4 },
    { ownedCards: 2, expectedPreviewCards: 2 },
  ])(
    'returns $expectedPreviewCards previews for a season containing $ownedCards owned cards',
    async ({ ownedCards, expectedPreviewCards }) => {
      const cards = Array.from({ length: ownedCards }, (_, index) =>
        ownedPreviewCard({
          cardId: `card-${index + 1}`,
          number: index + 1,
          variants: [{ id: `variant-${index + 1}`, quantity: index + 1 }],
        }),
      );
      const ownershipRows = Array.from({ length: ownedCards }, (_, index) =>
        seasonOwnershipRow(`card-${index + 1}`, index + 1),
      );
      const prisma = {
        cardSeason: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'season-a',
              name: 'Origines',
              slug: 'origines',
              code: 'ORI',
              sortOrder: 1,
              _count: { cards: 20 },
              boosters: [],
              cards,
            },
          ]),
        },
        userCard: { findMany: vi.fn().mockResolvedValue(ownershipRows) },
      };

      const [summary] = await new CollectionsService(prisma as never, {} as never).seasonSummaries(
        crypto.randomUUID(),
      );

      expect(summary?.previewCards).toHaveLength(expectedPreviewCards);
      expect(summary?.previewCards.map(({ card }) => card.id)).toEqual(
        cards.slice(0, expectedPreviewCards).map(({ id }) => id),
      );
      expect(summary?.collection).toEqual({
        uniqueOwnedCards: ownedCards,
        totalAvailableCards: 20,
        totalCopies: (ownedCards * (ownedCards + 1)) / 2,
        completionPercentage: ownedCards * 5,
      });
    },
  );

  it('hides empty seasons, quantities and completion when public permissions require it', async () => {
    const prisma = {
      cardSeason: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'season-a',
            name: 'Origines',
            slug: 'origines',
            code: 'ORI',
            sortOrder: 1,
            _count: { cards: 4 },
            boosters: [],
            cards: [
              ownedPreviewCard({
                cardId: 'card-rare',
                number: 8,
                variants: [{ id: 'variant-a', quantity: 2 }],
              }),
            ],
          },
          {
            id: 'season-b',
            name: 'Héritage',
            slug: 'heritage',
            code: 'HER',
            sortOrder: 2,
            _count: { cards: 3 },
            boosters: [],
            cards: [],
          },
        ]),
      },
      userCard: {
        findMany: vi.fn().mockResolvedValue([seasonOwnershipRow('card-rare', 2)]),
      },
    };
    const access = {
      resolve: vi.fn().mockResolvedValue({
        profile: { id: crypto.randomUUID() },
        preferences: { collectionVisibility: 'PUBLIC' },
        permissions: {
          canViewCollection: true,
          canViewQuantities: true,
          canViewCollectionCompletion: false,
        },
      }),
    };

    const result = await new CollectionsService(
      prisma as never,
      access as never,
    ).publicSeasonSummaries('lucas');

    expect(result).toHaveLength(1);
    expect(result[0]?.collection).toEqual({ uniqueOwnedCards: 1, totalCopies: 2 });
    expect(result[0]?.previewCards[0]).toMatchObject({ quantity: 2 });
    expect(result[0]?.previewCards[0]).not.toHaveProperty('lockedQuantity');
    expect(result[0]?.previewCards[0]?.ownedVariants[0]).toMatchObject({ quantity: 2 });
    expect(result[0]?.previewCards[0]?.ownedVariants[0]).not.toHaveProperty('lockedQuantity');
    expect(result[0]?.previewCards[0]?.ownedVariants[0]).not.toHaveProperty('lastObtainedAt');
  });

  it('applies season-specific search, facets, ownership and pagination on the server', async () => {
    const card = {
      ...seasonCard('card-a', 7),
      variants: [
        {
          id: 'variant-a',
          cardId: 'card-a',
          name: 'Standard',
          slug: 'standard',
          finish: 'standard',
          artworkPath: null,
          displayOrder: 0,
          createdAt: fixedNow,
          updatedAt: fixedNow,
          userCards: [],
        },
      ],
    };
    const prisma = {
      cardSeason: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'season-a',
          name: 'Origines',
          slug: 'origines',
          code: 'ORI',
          sortOrder: 1,
          _count: { cards: 20 },
          boosters: [],
        }),
      },
      card: {
        findMany: vi.fn().mockResolvedValue([card]),
        count: vi.fn().mockResolvedValue(1),
      },
      userCard: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ quantity: 3, cardVariant: { cardId: 'owned-card' } }]),
      },
    };
    const userId = crypto.randomUUID();

    await new CollectionsService(prisma as never, {} as never).seasonDetails(userId, 'origines', {
      page: 2,
      pageSize: 10,
      search: 'sentinelle',
      rarity: 'rare',
      type: 'allie',
      isCommander: false,
      owned: false,
      sort: 'rarity',
    });

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ rarity: { sortOrder: 'desc' } }, { number: 'asc' }],
        where: expect.objectContaining({
          seasonId: 'season-a',
          rarity: { slug: 'rare' },
          typeLinks: { some: { type: { slug: 'allie' } } },
          isCommander: false,
          variants: {
            none: { userCards: { some: { userId, quantity: { gt: 0 } } } },
          },
        }),
      }),
    );
  });
});

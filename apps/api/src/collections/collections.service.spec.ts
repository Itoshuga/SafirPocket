import { describe, expect, it, vi } from 'vitest';
import { CollectionsService } from './collections.service.js';

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
});

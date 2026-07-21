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
    const service = new CollectionsService(prisma as never);
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
    const service = new CollectionsService(prisma as never);
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
});

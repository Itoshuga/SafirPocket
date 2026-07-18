import { describe, expect, it, vi } from 'vitest';
import { CardsService } from './cards.service.js';

const now = new Date();
const publicCard = {
  id: crypto.randomUUID(),
  setId: null,
  name: 'Carte de test',
  slug: 'carte-de-test-1',
  number: 1n,
  collectionNumber: '1',
  attack: 2n,
  defense: 3n,
  value: 1n,
  description: null,
  imageUrl: null,
  artworkPath: null,
  isCommander: false,
  rarityId: crypto.randomUUID(),
  seasonId: crypto.randomUUID(),
  cost: 1,
  status: 'published' as const,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  set: null,
  rarity: { id: crypto.randomUUID(), name: 'Rare', slug: 'rare', displayColor: null },
  season: { id: crypto.randomUUID(), name: 'Origines', slug: 'origines', code: 'ORI' },
  typeLinks: [
    {
      typeId: crypto.randomUUID(),
      sortOrder: 0,
      type: { id: crypto.randomUUID(), name: 'Allié', slug: 'allie', displayColor: null },
    },
  ],
};

describe('CardsService', () => {
  it('retrieves only active, non-archived public cards and paginates them', async () => {
    const prisma = {
      card: {
        findMany: vi.fn().mockResolvedValue([publicCard]),
        count: vi.fn().mockResolvedValue(1),
      },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    };
    const service = new CardsService(prisma as never);
    const result = await service.listCards({ page: 1, pageSize: 24, sort: 'number' });

    expect(result.data[0]).toMatchObject({ name: 'Carte de test', number: 1 });
    expect(result.pagination.total).toBe(1);
    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'published',
          isActive: true,
          deletedAt: null,
        }),
        take: 24,
      }),
    );
  });
});

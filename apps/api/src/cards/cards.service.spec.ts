import { describe, expect, it, vi } from 'vitest';
import { CardsService } from './cards.service.js';

describe('CardsService', () => {
  it('retrieves only the public card query and paginates it', async () => {
    const publicCard = { id: crypto.randomUUID(), name: 'Carte de test', status: 'published' };
    const prisma = {
      card: {
        findMany: vi.fn().mockResolvedValue([publicCard]),
        count: vi.fn().mockResolvedValue(1),
      },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    };
    const service = new CardsService(prisma as never);
    const result = await service.listCards({ page: 1, pageSize: 24, sort: 'number' });
    expect(result.data).toEqual([publicCard]);
    expect(result.pagination.total).toBe(1);
    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' }, take: 24 }),
    );
  });
});

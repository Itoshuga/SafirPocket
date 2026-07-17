import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DecksService } from './decks.service.js';

describe('DecksService ownership', () => {
  it("does not expose or update another user's deck", async () => {
    const prisma = { deck: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new DecksService(prisma as never);
    await expect(
      service.update(crypto.randomUUID(), crypto.randomUUID(), { name: 'Intrusion' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.deck.findFirst).toHaveBeenCalledOnce();
  });

  it('reserves only the additional quantity when a deck card changes', async () => {
    const userId = crypto.randomUUID();
    const deckId = crypto.randomUUID();
    const cardVariantId = crypto.randomUUID();
    const tx = {
      userCard: {
        findUnique: vi.fn().mockResolvedValue({ quantity: 5, lockedQuantity: 2 }),
        update: vi.fn().mockResolvedValue({}),
      },
      deckCard: {
        findUnique: vi.fn().mockResolvedValue({ quantity: 2 }),
        upsert: vi.fn().mockResolvedValue({ quantity: 3 }),
      },
    };
    const prisma = {
      deck: { findFirst: vi.fn().mockResolvedValue({ id: deckId }) },
      runInTransaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new DecksService(prisma as never);
    await service.addCard(userId, deckId, { cardVariantId, quantity: 3 });
    expect(tx.userCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lockedQuantity: { increment: 1 } } }),
    );
  });
});

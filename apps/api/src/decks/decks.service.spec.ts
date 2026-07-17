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
});

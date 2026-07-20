import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BoostersService } from './boosters.service.js';

const ids = {
  user: crypto.randomUUID(),
  product: crypto.randomUUID(),
  season: crypto.randomUUID(),
  common: crypto.randomUUID(),
  rare: crypto.randomUUID(),
};

function completedOpening() {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    userId: ids.user,
    boosterProductId: ids.product,
    seasonId: ids.season,
    idempotencyKey: crypto.randomUUID(),
    status: 'completed',
    priceCurrency: null,
    priceAmount: 0n,
    boosterNameSnapshot: 'Booster Origines',
    errorCode: null,
    openedAt: now,
    createdAt: now,
    season: { id: ids.season, name: 'Origines', slug: 'origines', code: 'ORI' },
    boosterProduct: { id: ids.product, imageUrl: null },
    cards: [],
  };
}

describe('BoostersService', () => {
  it('returns the completed result for the same idempotency key without another transaction', async () => {
    const previous = completedOpening();
    const prisma = {
      packOpening: { findFirst: vi.fn().mockResolvedValue(previous) },
      runInTransaction: vi.fn(),
    };
    const service = new BoostersService(prisma as never, {} as never);
    const result = await service.openPack(ids.user, ids.product, previous.idempotencyKey);
    expect(result.openingId).toBe(previous.id);
    expect(result.cards).toHaveLength(0);
    expect(prisma.runInTransaction).not.toHaveBeenCalled();
  });

  it('does not debit or persist when a required card pool is empty', async () => {
    const transaction = {
      packOpening: { findUnique: vi.fn().mockResolvedValue(null) },
      boosterProduct: {
        findUnique: vi.fn().mockResolvedValue({
          id: ids.product,
          seasonId: ids.season,
          guaranteedCommonRarityId: ids.common,
          name: 'Booster Origines',
          status: 'published',
          isActive: true,
          deletedAt: null,
          cardsPerPack: 8,
          commonCardCount: 6,
          premiumCardCount: 2,
          priceAmount: 100n,
          priceCurrency: 'gem',
          availableFrom: null,
          availableUntil: null,
          season: { isActive: true, deletedAt: null },
          dropRates: [{ rarityId: ids.rare, dropRateBps: 10_000 }],
        }),
      },
      card: { findMany: vi.fn().mockResolvedValue([]) },
      wallet: { updateMany: vi.fn() },
      currencyTransaction: { create: vi.fn() },
    };
    const prisma = {
      packOpening: { findFirst: vi.fn().mockResolvedValue(null) },
      runInTransaction: vi.fn((work) => work(transaction)),
    };
    const draw = {
      assertRates: vi.fn(),
      draw: vi.fn(() => {
        throw new BadRequestException({ code: 'BOOSTER_HAS_NO_COMMON_CARDS' });
      }),
    };
    const service = new BoostersService(prisma as never, draw as never);
    await expect(
      service.openPack(ids.user, ids.product, crypto.randomUUID()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.wallet.updateMany).not.toHaveBeenCalled();
    expect(transaction.currencyTransaction.create).not.toHaveBeenCalled();
  });
});

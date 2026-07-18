import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BoostersService } from './boosters.service.js';

describe('BoostersService atomicity', () => {
  it('returns an existing completed opening for the same idempotency key', async () => {
    const previous = {
      id: crypto.randomUUID(),
      status: 'completed',
      priceCurrency: 'demo_gem',
      priceAmount: 100n,
      openedAt: new Date(),
      boosterProduct: {
        id: crypto.randomUUID(),
        name: 'Booster test',
        slug: 'booster-test',
        artworkPath: null,
      },
      cards: [
        {
          quantity: 1,
          cardVariant: {
            id: crypto.randomUUID(),
            cardId: crypto.randomUUID(),
            name: 'Standard',
            slug: 'standard',
            finish: 'standard',
            artworkPath: null,
            card: {
              id: crypto.randomUUID(),
              setId: null,
              name: 'Carte test',
              slug: 'carte-test-1',
              number: 1n,
              collectionNumber: '1',
              attack: 1n,
              defense: 1n,
              value: 1n,
              description: null,
              imageUrl: null,
              artworkPath: null,
              isCommander: false,
              rarityId: crypto.randomUUID(),
              seasonId: crypto.randomUUID(),
              cost: 1,
              status: 'published',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              set: null,
              rarity: {
                id: crypto.randomUUID(),
                name: 'Rare',
                slug: 'rare',
                displayColor: null,
              },
              season: {
                id: crypto.randomUUID(),
                name: 'Origines',
                slug: 'origines',
                code: 'ORI',
              },
              typeLinks: [
                {
                  typeId: crypto.randomUUID(),
                  sortOrder: 0,
                  type: {
                    id: crypto.randomUUID(),
                    name: 'Allié',
                    slug: 'allie',
                    displayColor: null,
                  },
                },
              ],
            },
          },
        },
      ],
    };
    const transaction = vi.fn();
    const prisma = {
      packOpening: { findFirst: vi.fn().mockResolvedValue(previous) },
      runInTransaction: transaction,
    };
    const service = new BoostersService(prisma as never);
    const result = await service.openPack(
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    );
    expect(result.id).toBe(previous.id);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.quantity).toBe(1);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rolls back the wallet and audit rows when draw configuration fails', async () => {
    const state = { balance: 100n, transactions: 0, openings: 0 };
    const tx = {
      packOpening: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(async () => {
          state.openings += 1;
          return { id: crypto.randomUUID() };
        }),
      },
      boosterProduct: {
        findFirst: vi.fn().mockResolvedValue({
          id: crypto.randomUUID(),
          priceCurrency: 'demo_gem',
          priceAmount: 100n,
          cardsPerPack: 1,
          slots: [{ slotIndex: 0, quantity: 1, weightConfig: { malformed: true } }],
        }),
      },
      wallet: {
        findUnique: vi.fn(async () => ({ balance: state.balance })),
        updateMany: vi.fn(async () => {
          state.balance -= 100n;
          return { count: 1 };
        }),
      },
      currencyTransaction: {
        create: vi.fn(async () => {
          state.transactions += 1;
        }),
      },
    };
    const prisma = {
      packOpening: { findFirst: vi.fn().mockResolvedValue(null) },
      runInTransaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
        const before = { ...state };
        try {
          return await callback(tx);
        } catch (error) {
          Object.assign(state, before);
          throw error;
        }
      }),
    };
    const service = new BoostersService(prisma as never);
    await expect(
      service.openPack(crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state).toEqual({ balance: 100n, transactions: 0, openings: 0 });
  });
});

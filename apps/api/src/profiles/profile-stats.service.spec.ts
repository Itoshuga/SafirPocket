import { describe, expect, it, vi } from 'vitest';
import { ProfileStatsService } from './profile-stats.service.js';

describe('ProfileStatsService', () => {
  it('calculates completion from every published active non-archived card', async () => {
    const prisma = {
      rankedSeason: { findFirst: vi.fn().mockResolvedValue(null) },
      rankedRating: { count: vi.fn() },
      userCard: {
        findMany: vi.fn().mockResolvedValue([
          { quantity: 3, cardVariant: { cardId: 'card-a', card: { legacyRarity: 'Rare' } } },
          { quantity: 2, cardVariant: { cardId: 'card-a', card: { legacyRarity: 'Rare' } } },
          { quantity: 1, cardVariant: { cardId: 'card-b', card: { legacyRarity: 'Common' } } },
        ]),
      },
      card: { count: vi.fn().mockResolvedValue(8) },
      deck: { count: vi.fn().mockResolvedValue(2) },
      match: { count: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(3) },
      friendship: { count: vi.fn().mockResolvedValue(4) },
    };
    const result = await new ProfileStatsService(prisma as never).get(crypto.randomUUID());
    expect(result).toEqual({
      uniqueCardsCount: 2,
      totalCardsCount: 6,
      totalAvailableCardsCount: 8,
      collectionCompletionPercentage: 25,
      decksCount: 2,
      friendsCount: 4,
      gamesPlayed: 5,
      winsCount: 3,
      currentRating: null,
      currentRank: null,
    });
    expect(prisma.card.count).toHaveBeenCalledWith({
      where: { status: 'published', isActive: true, deletedAt: null },
    });
    expect(prisma.userCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quantity: { gt: 0 } }),
      }),
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { ProfileStatsService } from './profile-stats.service.js';

function setup({
  uniqueCardsCount = 2,
  totalCopiesCount = 6,
  totalAvailableCardsCount = 8,
  decksCount = 2,
  friendsCount = 4,
  gamesPlayed = 5,
  winsCount = 3,
  lossesCount = 1,
  rating = null as { seasonId: string; rating: number } | null,
} = {}) {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([
      {
        uniqueCardsCount: BigInt(uniqueCardsCount),
        totalCopiesCount: BigInt(totalCopiesCount),
        uniqueVariantsCount: 3n,
        favoriteRarity: 'Rare',
      },
    ]),
    card: { count: vi.fn().mockResolvedValue(totalAvailableCardsCount) },
    deck: { count: vi.fn().mockResolvedValue(decksCount) },
    friendship: { count: vi.fn().mockResolvedValue(friendsCount) },
    match: {
      count: vi
        .fn()
        .mockResolvedValueOnce(gamesPlayed)
        .mockResolvedValueOnce(winsCount)
        .mockResolvedValueOnce(lossesCount),
    },
    rankedSeason: {
      findFirst: vi.fn().mockResolvedValue(rating ? { id: rating.seasonId } : null),
    },
    rankedRating: {
      findUnique: vi.fn().mockResolvedValue(rating),
      count: vi.fn().mockResolvedValue(7),
    },
  };
  return { prisma, service: new ProfileStatsService(prisma as never) };
}

describe('ProfileStatsService', () => {
  it('uses server aggregates for distinct cards, copies, missing cards and completed games', async () => {
    const { prisma, service } = setup({
      rating: { seasonId: 'season-1', rating: 1200 },
    });

    await expect(service.get(crypto.randomUUID())).resolves.toEqual({
      collection: {
        uniqueCardsCount: 2,
        totalCopiesCount: 6,
        totalAvailableCardsCount: 8,
        missingCardsCount: 6,
        completionPercentage: 25,
      },
      social: { friendsCount: 4 },
      decks: { totalCount: 2 },
      game: {
        gamesPlayed: 5,
        winsCount: 3,
        lossesCount: 1,
        winRatePercentage: 60,
        currentRating: 1200,
        currentRank: 8,
      },
      visibility: {
        canViewCollectionStats: true,
        canViewGameStats: true,
        canViewFriendsCount: true,
      },
    });

    const query = (prisma.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join(' ');
    expect(query).toContain('count(distinct card_id)');
    expect(query).toContain('coalesce(sum(quantity), 0)');
    expect(query).toContain("c.status = 'published'");
    expect(prisma.card.count).toHaveBeenCalledWith({
      where: { status: 'published', isActive: true, deletedAt: null },
    });
    expect(prisma.match.count).toHaveBeenNthCalledWith(1, {
      where: { status: 'completed', players: { some: { userId: expect.any(String) } } },
    });
  });

  it('caps completion at 100 percent and never returns negative missing cards', async () => {
    const { service } = setup({
      uniqueCardsCount: 12,
      totalCopiesCount: 20,
      totalAvailableCardsCount: 8,
      gamesPlayed: 0,
      winsCount: 0,
      lossesCount: 0,
    });

    const result = await service.get(crypto.randomUUID());
    expect(result.collection).toMatchObject({
      missingCardsCount: 0,
      completionPercentage: 100,
    });
    expect(result).not.toHaveProperty('game');
  });

  it('skips private collection and game queries and counts only public decks when requested', async () => {
    const { prisma, service } = setup();

    const result = await service.get(crypto.randomUUID(), {
      includeCollection: false,
      includeGame: false,
      publicDecksOnly: true,
    });

    expect(result).toEqual({
      social: { friendsCount: 4 },
      decks: { totalCount: 2, publicCount: 2 },
      visibility: {
        canViewCollectionStats: false,
        canViewGameStats: false,
        canViewFriendsCount: true,
      },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.card.count).not.toHaveBeenCalled();
    expect(prisma.match.count).not.toHaveBeenCalled();
    expect(prisma.rankedSeason.findFirst).not.toHaveBeenCalled();
    expect(prisma.deck.count).toHaveBeenCalledWith({
      where: { ownerId: expect.any(String), visibility: 'public' },
    });
  });
});

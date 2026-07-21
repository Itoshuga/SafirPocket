import { Injectable } from '@nestjs/common';
import type { ProfileStats, ProfileSummary } from '@safir/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';

interface ProfileStatsCalculation {
  stats: ProfileStats;
  uniqueVariants: number;
  favoriteRarity: string | null;
}

@Injectable()
export class ProfileStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<ProfileStats> {
    return (await this.calculate(userId)).stats;
  }

  async legacySummary(userId: string): Promise<ProfileSummary> {
    const { stats, uniqueVariants, favoriteRarity } = await this.calculate(userId);
    return {
      collection: {
        totalCopies: stats.totalCardsCount,
        uniqueVariants,
        uniqueCards: stats.uniqueCardsCount,
        publishedCardCount: stats.totalAvailableCardsCount,
        completionRate: stats.collectionCompletionPercentage,
        favoriteRarity,
      },
      deckCount: stats.decksCount,
      matchCount: stats.gamesPlayed,
      wins: stats.winsCount,
      currentRating: stats.currentRating,
      currentRank: stats.currentRank,
      friendsCount: stats.friendsCount,
    };
  }

  private async calculate(userId: string): Promise<ProfileStatsCalculation> {
    const now = new Date();
    const season = await this.prisma.rankedSeason.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
      select: { id: true },
    });
    const [
      owned,
      totalAvailableCardsCount,
      decksCount,
      gamesPlayed,
      winsCount,
      rating,
      friendsCount,
    ] = await Promise.all([
      this.prisma.userCard.findMany({
        where: {
          userId,
          quantity: { gt: 0 },
          cardVariant: { card: { status: 'published', isActive: true, deletedAt: null } },
        },
        select: {
          quantity: true,
          cardVariant: { select: { cardId: true, card: { select: { legacyRarity: true } } } },
        },
      }),
      this.prisma.card.count({
        where: { status: 'published', isActive: true, deletedAt: null },
      }),
      this.prisma.deck.count({ where: { ownerId: userId } }),
      this.prisma.match.count({ where: { players: { some: { userId } } } }),
      this.prisma.match.count({ where: { winnerId: userId, status: 'completed' } }),
      season
        ? this.prisma.rankedRating.findUnique({
            where: { seasonId_userId: { seasonId: season.id, userId } },
          })
        : Promise.resolve(null),
      this.prisma.friendship.count({
        where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
      }),
    ]);
    const uniqueCardsCount = new Set(owned.map(({ cardVariant }) => cardVariant.cardId)).size;
    const rarityCounts = new Map<string, number>();
    for (const entry of owned) {
      const rarity = entry.cardVariant.card.legacyRarity;
      rarityCounts.set(rarity, (rarityCounts.get(rarity) ?? 0) + entry.quantity);
    }
    const currentRank = rating
      ? (await this.prisma.rankedRating.count({
          where: { seasonId: rating.seasonId, rating: { gt: rating.rating } },
        })) + 1
      : null;
    return {
      stats: {
        uniqueCardsCount,
        totalCardsCount: owned.reduce((sum, entry) => sum + entry.quantity, 0),
        totalAvailableCardsCount,
        collectionCompletionPercentage: totalAvailableCardsCount
          ? Math.round((uniqueCardsCount / totalAvailableCardsCount) * 1000) / 10
          : 0,
        decksCount,
        friendsCount,
        gamesPlayed,
        winsCount,
        currentRating: rating?.rating ?? null,
        currentRank,
      },
      uniqueVariants: owned.length,
      favoriteRarity: [...rarityCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  }
}

import { Injectable } from '@nestjs/common';
import type { ProfileStats, ProfileSummary } from '@safir/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';

interface CollectionAggregateRow {
  uniqueCardsCount: bigint | number;
  totalCopiesCount: bigint | number;
  uniqueVariantsCount: bigint | number;
  favoriteRarity: string | null;
}

interface ProfileStatsCalculation {
  stats: ProfileStats;
  uniqueVariants: number;
  favoriteRarity: string | null;
}

export interface ProfileStatsOptions {
  includeCollection?: boolean;
  includeCollectionQuantities?: boolean;
  includeCollectionCompletion?: boolean;
  includeGame?: boolean;
  publicDecksOnly?: boolean;
}

const asNumber = (value: bigint | number | null | undefined) => Number(value ?? 0);

@Injectable()
export class ProfileStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, options: ProfileStatsOptions = {}): Promise<ProfileStats> {
    return (await this.calculate(userId, options)).stats;
  }

  async legacySummary(userId: string): Promise<ProfileSummary> {
    const { stats, uniqueVariants, favoriteRarity } = await this.calculate(userId);
    const collection = stats.collection;
    const game = stats.game;
    return {
      collection: {
        totalCopies: collection?.totalCopiesCount ?? 0,
        uniqueVariants,
        uniqueCards: collection?.uniqueCardsCount ?? 0,
        publishedCardCount: collection?.totalAvailableCardsCount ?? 0,
        completionRate: collection?.completionPercentage ?? 0,
        favoriteRarity,
      },
      deckCount: stats.decks?.totalCount ?? 0,
      matchCount: game?.gamesPlayed ?? 0,
      wins: game?.winsCount ?? 0,
      currentRating: game?.currentRating ?? null,
      currentRank: game?.currentRank ?? null,
      friendsCount: stats.social?.friendsCount ?? 0,
    };
  }

  private async calculate(
    userId: string,
    options: ProfileStatsOptions = {},
  ): Promise<ProfileStatsCalculation> {
    const includeCollection = options.includeCollection ?? true;
    const includeCollectionQuantities = options.includeCollectionQuantities ?? true;
    const includeCollectionCompletion = options.includeCollectionCompletion ?? true;
    const includeGame = options.includeGame ?? true;
    const now = new Date();

    const [
      aggregateRows,
      totalAvailableCardsCount,
      decksCount,
      friendsCount,
      gamesPlayed,
      winsCount,
      lossesCount,
      season,
    ] = await Promise.all([
      includeCollection ? this.collectionAggregate(userId) : Promise.resolve([]),
      includeCollection && includeCollectionCompletion
        ? this.prisma.card.count({
            where: { status: 'published', isActive: true, deletedAt: null },
          })
        : Promise.resolve(0),
      this.prisma.deck.count({
        where: {
          ownerId: userId,
          ...(options.publicDecksOnly ? { visibility: 'public' } : {}),
        },
      }),
      this.prisma.friendship.count({
        where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
      }),
      includeGame
        ? this.prisma.match.count({
            where: { status: 'completed', players: { some: { userId } } },
          })
        : Promise.resolve(0),
      includeGame
        ? this.prisma.match.count({ where: { winnerId: userId, status: 'completed' } })
        : Promise.resolve(0),
      includeGame
        ? this.prisma.match.count({
            where: {
              status: 'completed',
              winnerId: { not: null },
              NOT: { winnerId: userId },
              players: { some: { userId } },
            },
          })
        : Promise.resolve(0),
      includeGame
        ? this.prisma.rankedSeason.findFirst({
            where: { startsAt: { lte: now }, endsAt: { gt: now } },
            orderBy: { startsAt: 'desc' },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const rating =
      includeGame && season
        ? await this.prisma.rankedRating.findUnique({
            where: { seasonId_userId: { seasonId: season.id, userId } },
          })
        : null;
    const currentRank = rating
      ? (await this.prisma.rankedRating.count({
          where: { seasonId: rating.seasonId, rating: { gt: rating.rating } },
        })) + 1
      : null;

    const aggregate = aggregateRows[0];
    const uniqueCardsCount = asNumber(aggregate?.uniqueCardsCount);
    const totalCopiesCount = asNumber(aggregate?.totalCopiesCount);
    const missingCardsCount = Math.max(totalAvailableCardsCount - uniqueCardsCount, 0);
    const completionPercentage = totalAvailableCardsCount
      ? Math.min(100, Math.round((uniqueCardsCount / totalAvailableCardsCount) * 1000) / 10)
      : 0;
    const hasGameActivity = gamesPlayed > 0 || Boolean(rating);

    return {
      stats: {
        ...(includeCollection
          ? {
              collection: {
                uniqueCardsCount,
                ...(includeCollectionQuantities ? { totalCopiesCount } : {}),
                ...(includeCollectionCompletion
                  ? {
                      totalAvailableCardsCount,
                      missingCardsCount,
                      completionPercentage,
                    }
                  : {}),
              },
            }
          : {}),
        social: { friendsCount },
        decks: {
          totalCount: decksCount,
          ...(options.publicDecksOnly ? { publicCount: decksCount } : {}),
        },
        ...(includeGame && hasGameActivity
          ? {
              game: {
                gamesPlayed,
                winsCount,
                lossesCount,
                winRatePercentage: gamesPlayed
                  ? Math.min(100, Math.round((winsCount / gamesPlayed) * 1000) / 10)
                  : 0,
                currentRating: rating?.rating ?? null,
                currentRank,
              },
            }
          : {}),
        visibility: {
          canViewCollectionStats: includeCollection,
          canViewGameStats: includeGame,
          canViewFriendsCount: true,
        },
      },
      uniqueVariants: asNumber(aggregate?.uniqueVariantsCount),
      favoriteRarity: aggregate?.favoriteRarity ?? null,
    };
  }

  private collectionAggregate(userId: string) {
    return this.prisma.$queryRaw<CollectionAggregateRow[]>`
      with owned as (
        select
          cv.card_id,
          c.rarity,
          uc.quantity
        from public.user_cards uc
        inner join public.card_variants cv on cv.id = uc.card_variant_id
        inner join public.cards c on c.id = cv.card_id
        where uc.user_id = ${userId}::uuid
          and uc.quantity > 0
          and c.status = 'published'
          and c.is_active = true
          and c.deleted_at is null
      )
      select
        count(distinct card_id) as "uniqueCardsCount",
        coalesce(sum(quantity), 0) as "totalCopiesCount",
        count(*) as "uniqueVariantsCount",
        (
          select rarity
          from owned
          group by rarity
          order by sum(quantity) desc, rarity asc
          limit 1
        ) as "favoriteRarity"
      from owned
    `;
  }
}

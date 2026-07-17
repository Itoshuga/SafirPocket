import { Injectable } from '@nestjs/common';
import type { RankingsQuery } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async leaderboard(query: RankingsQuery) {
    const season = await this.currentSeason();
    if (!season) {
      return {
        season: null,
        data: [],
        pagination: { page: query.page, pageSize: query.pageSize, total: 0, pageCount: 0 },
      };
    }
    const where = {
      seasonId: season.id,
      ...(query.search
        ? {
            user: {
              OR: [
                { username: { contains: query.search, mode: 'insensitive' as const } },
                { displayName: { contains: query.search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };
    const [ratings, total] = await this.prisma.$transaction([
      this.prisma.rankedRating.findMany({
        where,
        select: {
          rating: true,
          wins: true,
          losses: true,
          draws: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarPath: true,
              bio: true,
              role: true,
            },
          },
        },
        orderBy: [{ rating: 'desc' }, { wins: 'desc' }, { userId: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.rankedRating.count({ where }),
    ]);
    const startRank = (query.page - 1) * query.pageSize + 1;
    return {
      season,
      data: ratings.map((rating, index) => ({ ...rating, rank: startRank + index })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async myRanking(userId: string) {
    const season = await this.currentSeason();
    if (!season) return { season: null, entry: null };
    const rating = await this.prisma.rankedRating.findUnique({
      where: { seasonId_userId: { seasonId: season.id, userId } },
      select: {
        rating: true,
        wins: true,
        losses: true,
        draws: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarPath: true,
            bio: true,
            role: true,
          },
        },
      },
    });
    if (!rating) return { season, entry: null };
    const rank =
      (await this.prisma.rankedRating.count({
        where: { seasonId: season.id, rating: { gt: rating.rating } },
      })) + 1;
    return { season, entry: { ...rating, rank } };
  }

  private async currentSeason() {
    const now = new Date();
    const active = await this.prisma.rankedSeason.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
      select: { id: true, slug: true, name: true, startsAt: true, endsAt: true },
    });
    if (active) return active;
    return this.prisma.rankedSeason.findFirst({
      where: { startsAt: { lte: now } },
      orderBy: { startsAt: 'desc' },
      select: { id: true, slug: true, name: true, startsAt: true, endsAt: true },
    });
  }
}

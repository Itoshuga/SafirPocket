import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProfileUpdateInput } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile)
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil introuvable.' });
    return profile;
  }

  async updateMe(userId: string, input: ProfileUpdateInput) {
    if (input.username) {
      const existing = await this.prisma.profile.findFirst({
        where: { username: { equals: input.username, mode: 'insensitive' }, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'USERNAME_UNAVAILABLE',
          message: "Ce nom d'utilisateur est déjà utilisé.",
        });
      }
    }
    return this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarPath !== undefined ? { avatarPath: input.avatarPath } : {}),
      },
    });
  }

  async summary(userId: string) {
    const now = new Date();
    const season = await this.prisma.rankedSeason.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
      select: { id: true },
    });
    const [owned, publishedCardCount, deckCount, matchCount, wins, rating] = await Promise.all([
      this.prisma.userCard.findMany({
        where: { userId, cardVariant: { card: { status: 'published' } } },
        select: {
          quantity: true,
          cardVariant: { select: { cardId: true, card: { select: { rarity: true } } } },
        },
      }),
      this.prisma.card.count({ where: { status: 'published' } }),
      this.prisma.deck.count({ where: { ownerId: userId } }),
      this.prisma.match.count({ where: { players: { some: { userId } } } }),
      this.prisma.match.count({ where: { winnerId: userId, status: 'completed' } }),
      season
        ? this.prisma.rankedRating.findUnique({
            where: { seasonId_userId: { seasonId: season.id, userId } },
          })
        : Promise.resolve(null),
    ]);
    const uniqueCards = new Set(owned.map(({ cardVariant }) => cardVariant.cardId)).size;
    const rarityCounts = new Map<string, number>();
    for (const entry of owned) {
      const rarity = entry.cardVariant.card.rarity;
      rarityCounts.set(rarity, (rarityCounts.get(rarity) ?? 0) + entry.quantity);
    }
    const currentRank = rating
      ? (await this.prisma.rankedRating.count({
          where: { seasonId: rating.seasonId, rating: { gt: rating.rating } },
        })) + 1
      : null;
    return {
      collection: {
        totalCopies: owned.reduce((sum, entry) => sum + entry.quantity, 0),
        uniqueVariants: owned.length,
        uniqueCards,
        publishedCardCount,
        completionRate: publishedCardCount
          ? Math.round((uniqueCards / publishedCardCount) * 1000) / 10
          : 0,
        favoriteRarity: [...rarityCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      },
      deckCount,
      matchCount,
      wins,
      currentRating: rating?.rating ?? null,
      currentRank,
    };
  }
}

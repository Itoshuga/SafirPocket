import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProfileUpdateInput } from '@safir/validation';
import { normalizeUsername } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserProfile } from './profile.mapper.js';
import { AvatarStorageService } from './avatar-storage.service.js';

const usernameCooldownMs = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarStorageService,
  ) {}

  async getMe(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!profile)
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil introuvable.' });
    return toUserProfile(profile);
  }

  async updateMe(userId: string, input: ProfileUpdateInput) {
    const current = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!current) {
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil introuvable.' });
    }
    const nextUsername = input.username;
    const usernameChanges = nextUsername !== undefined && nextUsername !== current.username;
    if (nextUsername !== undefined && nextUsername !== current.username) {
      const availableAt = current.usernameChangedAt
        ? new Date(current.usernameChangedAt.getTime() + usernameCooldownMs)
        : null;
      if (availableAt && availableAt > new Date()) {
        throw new ConflictException({
          code: 'USERNAME_CHANGE_COOLDOWN',
          message: "Le nom d'utilisateur ne peut être modifié qu'une fois tous les 30 jours.",
          details: { availableAt: availableAt.toISOString() },
          fieldErrors: {
            username: [
              `Un nouveau changement sera possible le ${availableAt.toLocaleDateString('fr-FR')}.`,
            ],
          },
        });
      }
      const existing = await this.prisma.userProfile.findFirst({
        where: { normalizedUsername: normalizeUsername(nextUsername), NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'USERNAME_ALREADY_EXISTS',
          message: "Ce nom d'utilisateur est déjà utilisé.",
        });
      }
    }
    if (input.avatarUrl) await this.avatars.verifyOwnedAvatar(userId, input.avatarUrl);
    try {
      const profile = await this.prisma.userProfile.update({
        where: { id: userId },
        data: {
          ...(input.username !== undefined
            ? {
                username: input.username,
                normalizedUsername: normalizeUsername(input.username),
                ...(usernameChanges ? { usernameChangedAt: new Date() } : {}),
              }
            : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        },
      });
      if (input.avatarUrl !== undefined && input.avatarUrl !== current.avatarUrl) {
        await this.avatars.remove(current.avatarUrl);
      }
      return toUserProfile(profile);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'USERNAME_ALREADY_EXISTS',
          message: "Ce nom d'utilisateur est déjà utilisé.",
        });
      }
      throw error;
    }
  }

  async summary(userId: string) {
    const now = new Date();
    const season = await this.prisma.rankedSeason.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
      select: { id: true },
    });
    const [owned, publishedCardCount, deckCount, matchCount, wins, rating, friendsCount] =
      await Promise.all([
        this.prisma.userCard.findMany({
          where: {
            userId,
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
    const uniqueCards = new Set(owned.map(({ cardVariant }) => cardVariant.cardId)).size;
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
      friendsCount,
    };
  }
}

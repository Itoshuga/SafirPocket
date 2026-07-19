import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FriendshipStatus,
  PaginatedResponse,
  PublicProfileStats,
  PublicUserProfile,
  UserSearchResult,
} from '@safir/shared-types';
import { normalizeUsername, type UserSearchQuery } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  preferences: { select: { profileVisibility: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async publicProfile(username: string, viewerId?: string): Promise<PublicUserProfile> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { normalizedUsername: normalizeUsername(username) },
      include: { preferences: true },
    });
    if (
      !profile ||
      profile.status !== 'ACTIVE' ||
      profile.isDeactivated ||
      profile.deletionProcessedAt
    ) {
      this.notAvailable();
    }

    const preferences = profile.preferences;
    const ownProfile = viewerId === profile.id;
    let friendshipStatus: FriendshipStatus = 'NONE';
    if (viewerId && !ownProfile) {
      const block = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerUserId: viewerId, blockedUserId: profile.id },
            { blockerUserId: profile.id, blockedUserId: viewerId },
          ],
        },
      });
      if (block?.blockerUserId === profile.id) this.notAvailable();
      friendshipStatus = block ? 'BLOCKED' : await this.friendshipStatus(viewerId, profile.id);
    }

    if (preferences?.profileVisibility === 'PRIVATE' && !ownProfile) {
      return {
        username: profile.username,
        displayName: null,
        avatarUrl: null,
        bio: null,
        isPioneer: false,
        profileVisibility: 'PRIVATE',
        createdAt: profile.createdAt.toISOString(),
        publicStats: { friendsCount: 0 },
        ...(viewerId ? { friendship: { status: friendshipStatus } } : {}),
      };
    }

    const publicStats = await this.publicStats(profile.id, {
      showCollectionStats: preferences?.showCollectionStats ?? true,
      showGameStats: preferences?.showGameStats ?? true,
    });
    return {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      isPioneer: profile.role === 'PIONEER',
      profileVisibility: preferences?.profileVisibility ?? 'PUBLIC',
      createdAt: profile.createdAt.toISOString(),
      publicStats,
      ...(viewerId && !ownProfile ? { friendship: { status: friendshipStatus } } : {}),
    };
  }

  async search(
    viewerId: string,
    query: UserSearchQuery,
  ): Promise<PaginatedResponse<UserSearchResult>> {
    const normalizedQuery = normalizeUsername(query.query);
    const blockedRelations = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerUserId: viewerId }, { blockedUserId: viewerId }] },
      select: { blockerUserId: true, blockedUserId: true },
    });
    const excludedIds = new Set<string>([viewerId]);
    for (const block of blockedRelations) {
      excludedIds.add(block.blockerUserId === viewerId ? block.blockedUserId : block.blockerUserId);
    }
    const where = {
      id: { notIn: [...excludedIds] },
      normalizedUsername: { contains: normalizedQuery },
      status: 'ACTIVE' as const,
      isDeactivated: false,
      deletionProcessedAt: null,
      preferences: { is: { appearInUserSearch: true } },
    };
    const [profiles, total] = await Promise.all([
      this.prisma.userProfile.findMany({
        where,
        select: publicUserSelect,
        orderBy: { normalizedUsername: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.userProfile.count({ where }),
    ]);
    const statuses = await this.friendshipStatuses(
      viewerId,
      profiles.map(({ id }) => id),
    );
    return {
      data: profiles.map((profile) => ({
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        isPioneer: profile.role === 'PIONEER',
        profileVisibility: profile.preferences?.profileVisibility ?? 'PUBLIC',
        friendshipStatus: statuses.get(profile.id) ?? 'NONE',
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  private async publicStats(
    userId: string,
    visibility: { showCollectionStats: boolean; showGameStats: boolean },
  ): Promise<PublicProfileStats> {
    const [friendsCount, cards, decksCount, matchCount, wins, season] = await Promise.all([
      this.prisma.friendship.count({
        where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
      }),
      visibility.showCollectionStats
        ? this.prisma.userCard.findMany({
            where: { userId },
            select: { quantity: true, cardVariant: { select: { cardId: true } } },
          })
        : Promise.resolve(null),
      visibility.showCollectionStats
        ? this.prisma.deck.count({ where: { ownerId: userId } })
        : Promise.resolve(null),
      visibility.showGameStats
        ? this.prisma.match.count({ where: { players: { some: { userId } } } })
        : Promise.resolve(null),
      visibility.showGameStats
        ? this.prisma.match.count({ where: { winnerId: userId, status: 'completed' } })
        : Promise.resolve(null),
      visibility.showGameStats
        ? this.prisma.rankedSeason.findFirst({
            where: { startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
            orderBy: { startsAt: 'desc' },
          })
        : Promise.resolve(null),
    ]);
    const rating = season
      ? await this.prisma.rankedRating.findUnique({
          where: { seasonId_userId: { seasonId: season.id, userId } },
        })
      : null;
    const rank = rating
      ? (await this.prisma.rankedRating.count({
          where: { seasonId: rating.seasonId, rating: { gt: rating.rating } },
        })) + 1
      : null;
    return {
      friendsCount,
      ...(cards
        ? {
            cardsCount: cards.reduce((total, card) => total + card.quantity, 0),
            uniqueCardsCount: new Set(cards.map(({ cardVariant }) => cardVariant.cardId)).size,
          }
        : {}),
      ...(decksCount !== null ? { decksCount } : {}),
      ...(matchCount !== null ? { matchCount, wins: wins ?? 0 } : {}),
      ...(visibility.showGameStats
        ? { currentRating: rating?.rating ?? null, currentRank: rank }
        : {}),
    };
  }

  private async friendshipStatus(viewerId: string, targetId: string): Promise<FriendshipStatus> {
    const statuses = await this.friendshipStatuses(viewerId, [targetId]);
    return statuses.get(targetId) ?? 'NONE';
  }

  private async friendshipStatuses(viewerId: string, targetIds: string[]) {
    const statuses = new Map<string, FriendshipStatus>();
    if (!targetIds.length) return statuses;
    const [friendships, requests] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          OR: [
            { userOneId: viewerId, userTwoId: { in: targetIds } },
            { userTwoId: viewerId, userOneId: { in: targetIds } },
          ],
        },
      }),
      this.prisma.friendRequest.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { senderUserId: viewerId, receiverUserId: { in: targetIds } },
            { receiverUserId: viewerId, senderUserId: { in: targetIds } },
          ],
        },
      }),
    ]);
    for (const friendship of friendships) {
      statuses.set(
        friendship.userOneId === viewerId ? friendship.userTwoId : friendship.userOneId,
        'FRIENDS',
      );
    }
    for (const request of requests) {
      if (request.senderUserId === viewerId) {
        statuses.set(request.receiverUserId, 'PENDING_SENT');
      } else {
        statuses.set(request.senderUserId, 'PENDING_RECEIVED');
      }
    }
    return statuses;
  }

  private notAvailable(): never {
    throw new NotFoundException({
      code: 'PUBLIC_PROFILE_NOT_AVAILABLE',
      message: "Ce profil n'est pas disponible.",
    });
  }
}

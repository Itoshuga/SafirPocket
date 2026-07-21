import { ForbiddenException, Injectable } from '@nestjs/common';
import type {
  FriendshipStatus,
  PaginatedResponse,
  PublicProfileStats,
  PublicUserProfile,
  UserSearchResult,
} from '@safir/shared-types';
import { ROLE_LABELS } from '@safir/shared-types';
import { normalizeUsername, type UserSearchQuery } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfileStatsService } from '../profiles/profile-stats.service.js';
import { ProfileAccessPolicyService } from './profile-access-policy.service.js';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: ProfileAccessPolicyService,
    private readonly profileStats: ProfileStatsService,
  ) {}

  async publicProfile(username: string, viewerId?: string): Promise<PublicUserProfile> {
    const { profile, preferences, friendshipStatus, permissions } = await this.accessPolicy.resolve(
      username,
      viewerId,
    );
    if (!permissions.canViewProfile) {
      return {
        username: profile.username,
        displayName: null,
        avatarUrl: null,
        bio: null,
        role: profile.role,
        roleLabel: ROLE_LABELS[profile.role],
        isPioneer: profile.role === 'PIONEER',
        profileVisibility: 'PRIVATE',
        collectionVisibility: 'PRIVATE',
        createdAt: profile.createdAt.toISOString(),
        friendship: { status: friendshipStatus },
        permissions,
      };
    }

    return {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      role: profile.role,
      roleLabel: ROLE_LABELS[profile.role],
      isPioneer: profile.role === 'PIONEER',
      profileVisibility: preferences.profileVisibility,
      collectionVisibility: preferences.collectionVisibility,
      createdAt: profile.createdAt.toISOString(),
      friendship: { status: friendshipStatus },
      permissions,
    };
  }

  async publicStats(username: string, viewerId?: string): Promise<PublicProfileStats> {
    const { profile, preferences, permissions } = await this.accessPolicy.resolve(
      username,
      viewerId,
    );
    if (!permissions.canViewStats) {
      throw new ForbiddenException({
        code: 'PROFILE_STATS_PRIVATE',
        message: 'Les statistiques de ce profil sont privées.',
      });
    }
    const stats = await this.profileStats.get(profile.id);
    return {
      friendsCount: stats.friendsCount,
      ...(preferences.showCollectionStats
        ? {
            decksCount: stats.decksCount,
            ...(permissions.canViewCollection ? { uniqueCardsCount: stats.uniqueCardsCount } : {}),
            ...(permissions.canViewQuantities ? { totalCardsCount: stats.totalCardsCount } : {}),
            ...(permissions.canViewCollectionCompletion
              ? {
                  totalAvailableCardsCount: stats.totalAvailableCardsCount,
                  collectionCompletionPercentage: stats.collectionCompletionPercentage,
                }
              : {}),
          }
        : {}),
      ...(preferences.showGameStats
        ? {
            gamesPlayed: stats.gamesPlayed,
            winsCount: stats.winsCount,
            currentRating: stats.currentRating,
            currentRank: stats.currentRank,
          }
        : {}),
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
        role: profile.role,
        roleLabel: ROLE_LABELS[profile.role],
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
}

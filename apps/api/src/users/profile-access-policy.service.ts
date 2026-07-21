import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CollectionVisibility,
  FriendshipStatus,
  ProfilePermissions,
  ProfileVisibility,
} from '@safir/shared-types';
import { normalizeUsername } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProfileAccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(username: string, viewerId?: string) {
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

    const profileVisibility: ProfileVisibility = profile.preferences?.profileVisibility ?? 'PUBLIC';
    const collectionVisibility: CollectionVisibility =
      profile.preferences?.collectionVisibility ?? 'PUBLIC';
    const ownProfile = viewerId === profile.id;
    let friendshipStatus: FriendshipStatus = ownProfile ? 'SELF' : 'NONE';
    let isFriend = false;

    if (viewerId && !ownProfile) {
      const [block, friendship, request] = await Promise.all([
        this.prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerUserId: viewerId, blockedUserId: profile.id },
              { blockerUserId: profile.id, blockedUserId: viewerId },
            ],
          },
        }),
        this.prisma.friendship.findFirst({
          where: {
            OR: [
              { userOneId: viewerId, userTwoId: profile.id },
              { userOneId: profile.id, userTwoId: viewerId },
            ],
          },
          select: { id: true },
        }),
        this.prisma.friendRequest.findFirst({
          where: {
            status: 'PENDING',
            OR: [
              { senderUserId: viewerId, receiverUserId: profile.id },
              { senderUserId: profile.id, receiverUserId: viewerId },
            ],
          },
          select: { senderUserId: true, receiverUserId: true },
        }),
      ]);
      if (block?.blockerUserId === profile.id) this.notAvailable();
      if (block) {
        friendshipStatus = 'BLOCKED';
      } else if (friendship) {
        friendshipStatus = 'FRIENDS';
        isFriend = true;
      } else if (request?.senderUserId === viewerId) {
        friendshipStatus = 'PENDING_SENT';
      } else if (request) {
        friendshipStatus = 'PENDING_RECEIVED';
      }
    }

    const canViewProfile = ownProfile || profileVisibility === 'PUBLIC';
    const canViewCollection =
      canViewProfile &&
      (ownProfile ||
        collectionVisibility === 'PUBLIC' ||
        (collectionVisibility === 'FRIENDS' && isFriend));
    const permissions: ProfilePermissions = {
      canViewProfile,
      canViewStats: canViewProfile,
      canViewCollection,
      canViewQuantities:
        canViewCollection && (ownProfile || (profile.preferences?.showCardQuantities ?? true)),
      canViewCollectionCompletion:
        canViewCollection &&
        (ownProfile || (profile.preferences?.showCollectionCompletion ?? true)),
      canSendFriendRequest:
        Boolean(viewerId) &&
        !ownProfile &&
        friendshipStatus === 'NONE' &&
        (profile.preferences?.allowFriendRequests ?? true),
      canBlock: Boolean(viewerId) && !ownProfile && friendshipStatus !== 'BLOCKED',
    };

    return {
      profile,
      preferences: {
        profileVisibility,
        collectionVisibility,
        showCollectionStats: profile.preferences?.showCollectionStats ?? true,
        showGameStats: profile.preferences?.showGameStats ?? true,
      },
      friendshipStatus,
      permissions,
    };
  }

  private notAvailable(): never {
    throw new NotFoundException({
      code: 'PUBLIC_PROFILE_NOT_AVAILABLE',
      message: "Ce profil n'est pas disponible.",
    });
  }
}

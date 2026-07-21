import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProfileAccessPolicyService } from './profile-access-policy.service.js';

const targetId = '22222222-2222-4222-8222-222222222222';
const viewerId = '11111111-1111-4111-8111-111111111111';

function setup({
  profileVisibility = 'PUBLIC',
  collectionVisibility = 'PUBLIC',
  friendship = false,
  profile = {},
}: {
  profileVisibility?: 'PUBLIC' | 'PRIVATE';
  collectionVisibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  friendship?: boolean;
  profile?: Record<string, unknown>;
} = {}) {
  const prisma = {
    userProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: targetId,
        username: 'lucas',
        role: 'USER',
        status: 'ACTIVE',
        isDeactivated: false,
        deletionProcessedAt: null,
        preferences: {
          profileVisibility,
          collectionVisibility,
          showCardQuantities: false,
          showCollectionCompletion: true,
          showCollectionStats: true,
          showGameStats: true,
          allowFriendRequests: true,
        },
        ...profile,
      }),
    },
    userBlock: { findFirst: vi.fn().mockResolvedValue(null) },
    friendship: { findFirst: vi.fn().mockResolvedValue(friendship ? { id: 'friendship' } : null) },
    friendRequest: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  return new ProfileAccessPolicyService(prisma as never);
}

describe('ProfileAccessPolicyService', () => {
  it('always grants the owner full collection access', async () => {
    const access = await setup({
      profileVisibility: 'PRIVATE',
      collectionVisibility: 'PRIVATE',
    }).resolve('lucas', targetId);
    expect(access.friendshipStatus).toBe('SELF');
    expect(access.permissions).toMatchObject({
      canViewProfile: true,
      canViewCollection: true,
      canViewQuantities: true,
    });
  });

  it('grants a friends-only collection only to an actual friend', async () => {
    const visitor = await setup({ collectionVisibility: 'FRIENDS' }).resolve('lucas', viewerId);
    const friend = await setup({ collectionVisibility: 'FRIENDS', friendship: true }).resolve(
      'lucas',
      viewerId,
    );
    expect(visitor.permissions.canViewCollection).toBe(false);
    expect(friend.permissions.canViewCollection).toBe(true);
    expect(friend.permissions.canViewQuantities).toBe(false);
  });

  it('keeps collection access denied for a private profile', async () => {
    const access = await setup({ profileVisibility: 'PRIVATE' }).resolve('lucas', viewerId);
    expect(access.permissions).toMatchObject({
      canViewProfile: false,
      canViewStats: false,
      canViewCollection: false,
    });
  });

  it('hides unavailable accounts behind a not-found response', async () => {
    await expect(
      setup({ profile: { isDeactivated: true } }).resolve('lucas', viewerId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service.js';

const profile = {
  id: crypto.randomUUID(),
  username: 'lucas',
  normalizedUsername: 'lucas',
  email: 'private@example.com',
  displayName: 'Lucas',
  avatarUrl: 'lucas/avatar.webp',
  bio: 'Collectionneur',
  role: 'MODERATOR' as const,
  status: 'ACTIVE' as const,
  isDeactivated: false,
  deletionProcessedAt: null,
  createdAt: new Date('2026-07-19T10:00:00.000Z'),
};

const fullPermissions = {
  canViewProfile: true,
  canViewStats: true,
  canViewCollection: true,
  canViewQuantities: true,
  canViewCollectionCompletion: true,
  canSendFriendRequest: false,
  canBlock: false,
};

function setup(overrides: Record<string, unknown> = {}) {
  const access = {
    profile,
    preferences: {
      profileVisibility: 'PUBLIC',
      collectionVisibility: 'PUBLIC',
      showCollectionStats: true,
      showGameStats: true,
    },
    friendshipStatus: 'NONE',
    permissions: fullPermissions,
    ...overrides,
  };
  const policy = { resolve: vi.fn().mockResolvedValue(access) };
  const stats = {
    get: vi.fn().mockResolvedValue({
      uniqueCardsCount: 4,
      totalCardsCount: 9,
      totalAvailableCardsCount: 20,
      collectionCompletionPercentage: 20,
      decksCount: 2,
      friendsCount: 3,
      gamesPlayed: 5,
      winsCount: 2,
      currentRating: 1200,
      currentRank: 8,
    }),
  };
  return { service: new UsersService({} as never, policy as never, stats as never), policy, stats };
}

describe('UsersService public profile', () => {
  it('returns the API role without exposing e-mail or moderation data', async () => {
    const result = await setup().service.publicProfile('Lucas');
    expect(result).toMatchObject({
      username: 'lucas',
      role: 'MODERATOR',
      roleLabel: 'Modérateur',
      friendship: { status: 'NONE' },
    });
    expect(result).not.toHaveProperty('email');
    expect(JSON.stringify(result)).not.toContain('private@example.com');
    expect(result).not.toHaveProperty('status');
  });

  it('returns only limited identity and permissions for a private profile', async () => {
    const { service } = setup({
      permissions: { ...fullPermissions, canViewProfile: false, canViewStats: false },
      preferences: {
        profileVisibility: 'PRIVATE',
        collectionVisibility: 'FRIENDS',
        showCollectionStats: true,
        showGameStats: true,
      },
    });
    await expect(service.publicProfile('lucas')).resolves.toMatchObject({
      username: 'lucas',
      displayName: null,
      avatarUrl: null,
      bio: null,
      role: 'MODERATOR',
      profileVisibility: 'PRIVATE',
      collectionVisibility: 'PRIVATE',
    });
  });

  it('masks quantities and completion independently in public statistics', async () => {
    const { service } = setup({
      permissions: {
        ...fullPermissions,
        canViewQuantities: false,
        canViewCollectionCompletion: false,
      },
    });
    const result = await service.publicStats('lucas');
    expect(result).toMatchObject({ uniqueCardsCount: 4, decksCount: 2, friendsCount: 3 });
    expect(result).not.toHaveProperty('totalCardsCount');
    expect(result).not.toHaveProperty('collectionCompletionPercentage');
  });
});

import { NotFoundException } from '@nestjs/common';
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
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  isDeactivated: false,
  deletionProcessedAt: null,
  createdAt: new Date(),
  preferences: {
    profileVisibility: 'PRIVATE' as const,
    showCollectionStats: true,
    showGameStats: true,
  },
};

function setup(value: typeof profile | null = profile) {
  const prisma = {
    userProfile: { findUnique: vi.fn().mockResolvedValue(value) },
    userBlock: { findFirst: vi.fn().mockResolvedValue(null) },
    friendship: { findMany: vi.fn().mockResolvedValue([]) },
    friendRequest: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return new UsersService(prisma as never);
}

describe('UsersService public profile', () => {
  it('returns only a limited state for a private profile', async () => {
    const result = await setup().publicProfile('Lucas');
    expect(result).toMatchObject({
      username: 'lucas',
      displayName: null,
      avatarUrl: null,
      bio: null,
      profileVisibility: 'PRIVATE',
    });
    expect(result).not.toHaveProperty('email');
    expect(JSON.stringify(result)).not.toContain('private@example.com');
  });

  it('hides deactivated profiles behind the same unavailable response', async () => {
    const service = setup({ ...profile, isDeactivated: true });
    await expect(service.publicProfile('lucas')).rejects.toBeInstanceOf(NotFoundException);
  });
});

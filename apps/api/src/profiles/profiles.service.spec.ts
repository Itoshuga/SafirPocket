import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProfilesService } from './profiles.service.js';

const now = new Date('2026-07-19T10:00:00.000Z');
const baseProfile = {
  id: crypto.randomUUID(),
  username: 'safir_user',
  normalizedUsername: 'safir_user',
  email: 'user@example.com',
  displayName: 'Safir User',
  avatarUrl: null,
  bannerUrl: null as string | null,
  bannerPositionY: 50,
  bio: null,
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  suspendedUntil: null,
  mustChangePassword: false,
  createdAt: now,
  updatedAt: now,
  lastLoginAt: now,
  usernameChangedAt: null as Date | null,
  isDeactivated: false,
  deactivatedAt: null,
  deletionRequestedAt: null,
  deletionScheduledFor: null,
  deletionCancelledAt: null,
  deletionProcessedAt: null,
  deletionReason: null,
};

function setup(profile = baseProfile) {
  const prisma = {
    userProfile: {
      findUnique: vi.fn().mockResolvedValue(profile),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...profile, ...data })),
    },
  };
  const avatars = { verifyOwnedAvatar: vi.fn(), remove: vi.fn() };
  const banners = { verifyOwnedBanner: vi.fn(), remove: vi.fn() };
  const stats = { legacySummary: vi.fn() };
  return {
    service: new ProfilesService(
      prisma as never,
      avatars as never,
      banners as never,
      stats as never,
    ),
    prisma,
    avatars,
    banners,
  };
}

describe('ProfilesService', () => {
  it('loads the current profile without exposing Auth internals', async () => {
    const { service } = setup();
    await expect(service.getMe(baseProfile.id)).resolves.toMatchObject({
      username: 'safir_user',
      email: 'user@example.com',
      deletion: { state: 'NONE' },
    });
  });

  it('normalizes a username and starts the 30 day cooldown', async () => {
    const { service, prisma } = setup();
    await service.updateMe(baseProfile.id, { username: 'New_User' });
    expect(prisma.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'New_User',
          normalizedUsername: 'new_user',
          usernameChangedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('refuses a username change during the cooldown', async () => {
    const { service } = setup({ ...baseProfile, usernameChangedAt: new Date() });
    await expect(
      service.updateMe(baseProfile.id, { username: 'other_user' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a duplicate normalized username', async () => {
    const { service, prisma } = setup();
    prisma.userProfile.findFirst.mockResolvedValueOnce({ id: crypto.randomUUID() } as never);
    await expect(
      service.updateMe(baseProfile.id, { username: 'Existing_User' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('verifies avatar ownership before persisting the storage path', async () => {
    const { service, avatars } = setup();
    const path = `${baseProfile.id}/avatar.webp`;
    await service.updateMe(baseProfile.id, { avatarUrl: path });
    expect(avatars.verifyOwnedAvatar).toHaveBeenCalledWith(baseProfile.id, path);
  });

  it('verifies a banner before persisting it and removes the replaced object', async () => {
    const currentPath = `${baseProfile.id}/old-banner.webp`;
    const nextPath = `${baseProfile.id}/new-banner.webp`;
    const { service, banners } = setup({ ...baseProfile, bannerUrl: currentPath });

    await service.updateBanner(baseProfile.id, {
      bannerUrl: nextPath,
      bannerPositionY: 72,
    });

    expect(banners.verifyOwnedBanner).toHaveBeenCalledWith(baseProfile.id, nextPath);
    expect(banners.remove).toHaveBeenCalledWith(currentPath);
  });
});

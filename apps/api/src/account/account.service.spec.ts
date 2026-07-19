import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { AccountService } from './account.service.js';

const userId = '11111111-1111-4111-8111-111111111111';
const user: AuthenticatedUser = {
  id: userId,
  email: 'user@example.com',
  username: 'safir_user',
  role: 'USER',
  status: 'ACTIVE',
  suspendedUntil: null,
  accessToken: 'access-token',
};
const profile = {
  id: userId,
  username: 'safir_user',
  normalizedUsername: 'safir_user',
  email: 'user@example.com',
  displayName: null,
  avatarUrl: null,
  bio: null,
  role: 'USER' as const,
  status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'BANNED',
  suspendedUntil: null,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
  usernameChangedAt: null,
  isDeactivated: false,
  deactivatedAt: null as Date | null,
  deletionRequestedAt: null as Date | null,
  deletionScheduledFor: null as Date | null,
  deletionCancelledAt: null as Date | null,
  deletionProcessedAt: null as Date | null,
  deletionReason: null,
};

function setup(current = profile) {
  const transaction = {
    userProfile: { update: vi.fn().mockResolvedValue(current) },
    userSecurityEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    userProfile: { findUnique: vi.fn().mockResolvedValue(current) },
    runInTransaction: vi.fn((operation) => operation(transaction)),
    userSecurityEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const auth = {
    assertRecentlyAuthenticated: vi.fn(),
    revokeAllSessions: vi.fn(),
    requestReauthentication: vi.fn(),
    updateEmail: vi.fn(),
    updatePassword: vi.fn(),
  };
  return { service: new AccountService(prisma as never, auth as never), transaction, auth };
}

describe('AccountService', () => {
  it('deactivates voluntarily without changing moderation status', async () => {
    const { service, transaction, auth } = setup();
    await service.deactivate(user, { confirmationUsername: 'SAFIR_USER', confirmed: true });
    expect(transaction.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDeactivated: true, deactivatedAt: expect.any(Date) }),
      }),
    );
    expect(auth.revokeAllSessions).toHaveBeenCalledWith('access-token');
  });

  it('never permits voluntary reactivation to bypass a ban', async () => {
    const { service } = setup({
      ...profile,
      status: 'BANNED',
      isDeactivated: true,
      deactivatedAt: new Date(),
    });
    await expect(
      service.reactivate(user, { confirmationUsername: 'safir_user', confirmed: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('schedules deletion after a 30 day grace period and deactivates the account', async () => {
    const { service, transaction } = setup();
    const before = Date.now();
    await service.requestDeletion(user, {
      confirmationUsername: 'safir_user',
      confirmed: true,
      reason: null,
    });
    const data = transaction.userProfile.update.mock.calls[0]?.[0].data as {
      deletionRequestedAt: Date;
      deletionScheduledFor: Date;
      isDeactivated: boolean;
    };
    expect(data.isDeactivated).toBe(true);
    expect(data.deletionScheduledFor.getTime() - data.deletionRequestedAt.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    expect(data.deletionRequestedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('cancels an active deletion request during the grace period', async () => {
    const { service, transaction } = setup({
      ...profile,
      isDeactivated: true,
      deactivatedAt: new Date(),
      deletionRequestedAt: new Date(),
      deletionScheduledFor: new Date(Date.now() + 60_000),
    });
    await service.cancelDeletion(user, {
      confirmationUsername: 'safir_user',
      confirmed: true,
    });
    expect(transaction.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isDeactivated: false,
          deactivatedAt: null,
          deletionCancelledAt: expect.any(Date),
        }),
      }),
    );
  });
});

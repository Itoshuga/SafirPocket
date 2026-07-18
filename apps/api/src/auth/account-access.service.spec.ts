import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AccountAccessService } from './account-access.service.js';

const activeProfile = {
  id: crypto.randomUUID(),
  email: 'amina@example.com',
  username: 'amina',
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  suspendedUntil: null,
  lastLoginAt: new Date(),
};

describe('AccountAccessService', () => {
  it('rejects an Auth identity without an application profile', async () => {
    const prisma = { userProfile: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new AccountAccessService(prisma as never);

    await expect(service.ensureActive(activeProfile.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each(['SUSPENDED', 'BANNED'] as const)('blocks a %s account', async (status) => {
    const prisma = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValue({
          ...activeProfile,
          status,
          suspendedUntil: status === 'SUSPENDED' ? new Date(Date.now() + 60_000) : null,
        }),
      },
    };
    const service = new AccountAccessService(prisma as never);

    await expect(service.ensureActive(activeProfile.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('expires a suspension atomically and records moderation plus audit history', async () => {
    const expiredAt = new Date(Date.now() - 60_000);
    const userProfile = {
      findUnique: vi.fn().mockResolvedValue({
        ...activeProfile,
        status: 'SUSPENDED',
        suspendedUntil: expiredAt,
      }),
      update: vi.fn().mockResolvedValue({ ...activeProfile, lastLoginAt: new Date() }),
    };
    const transaction = {
      userProfile: {
        update: vi.fn().mockResolvedValue({ ...activeProfile, lastLoginAt: new Date() }),
      },
      userModerationAction: { create: vi.fn().mockResolvedValue({}) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      userProfile,
      runInTransaction: vi.fn((operation) => operation(transaction)),
    };
    const service = new AccountAccessService(prisma as never);

    await expect(service.ensureActive(activeProfile.id)).resolves.toMatchObject({
      id: activeProfile.id,
      status: 'ACTIVE',
    });
    expect(transaction.userModerationAction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'USER_UNSUSPENDED' }) }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'USER_SUSPENSION_EXPIRED' }),
      }),
    );
  });
});

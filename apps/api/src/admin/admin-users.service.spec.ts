import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { AdminUsersService } from './admin-users.service.js';

const targetId = crypto.randomUUID();
const adminId = crypto.randomUUID();
const now = new Date();

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: targetId,
    username: 'target_user',
    normalizedUsername: 'target_user',
    email: 'target@example.com',
    displayName: 'Target',
    avatarUrl: null,
    bio: null,
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    suspendedUntil: null,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    ...overrides,
  };
}

const administrator: AuthenticatedUser = {
  id: adminId,
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMINISTRATOR',
  status: 'ACTIVE',
  suspendedUntil: null,
};

function serviceFor(target: ReturnType<typeof profile>, administratorCount = 1) {
  const warning = {
    id: crypto.randomUUID(),
    userId: target.id,
    issuedByUserId: adminId,
    reason: 'Rappel des règles',
    internalNote: null,
    severity: 'MEDIUM' as const,
    isActive: true,
    acknowledgedAt: null,
    revokedAt: null,
    revokedByUserId: null,
    createdAt: now,
    updatedAt: now,
    issuedBy: { id: adminId, username: 'admin', displayName: 'Admin' },
    revokedBy: null,
  };
  const transaction = {
    userProfile: {
      findUnique: vi.fn().mockResolvedValue(target),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...target, ...data, updatedAt: new Date() }),
        ),
      count: vi.fn().mockResolvedValue(administratorCount),
    },
    userWarning: {
      create: vi.fn().mockResolvedValue(warning),
      findFirst: vi.fn().mockResolvedValue(warning),
      update: vi.fn().mockResolvedValue({
        ...warning,
        isActive: false,
        revokedAt: now,
        revokedByUserId: adminId,
        revokedBy: { id: adminId, username: 'admin', displayName: 'Admin' },
      }),
    },
    userModerationAction: { create: vi.fn().mockResolvedValue({}) },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    runInTransaction: vi.fn((operation) => operation(transaction)),
    userProfile: transaction.userProfile,
  };
  const auth = {
    updateEmail: vi.fn(),
    sendPasswordReset: vi.fn(),
    setTemporaryPassword: vi.fn(),
  };
  return {
    service: new AdminUsersService(prisma as never, auth as never),
    transaction,
    prisma,
    auth,
  };
}

describe('AdminUsersService', () => {
  it('prevents self-moderation', async () => {
    const actor = { ...administrator, id: targetId };
    const { service } = serviceFor(profile({ role: 'ADMINISTRATOR' }));

    await expect(
      service.ban(
        actor,
        targetId,
        { reason: 'Test de protection', confirmationUsername: 'target_user' },
        'request-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents a moderator from banning an administrator', async () => {
    const moderator: AuthenticatedUser = { ...administrator, role: 'MODERATOR' };
    const { service } = serviceFor(profile({ role: 'ADMINISTRATOR' }));

    await expect(
      service.ban(
        moderator,
        targetId,
        { reason: 'Action interdite', confirmationUsername: 'target_user' },
        'request-2',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protects the last active administrator from demotion', async () => {
    const { service } = serviceFor(profile({ role: 'ADMINISTRATOR' }), 0);

    await expect(
      service.changeRole(
        administrator,
        targetId,
        { role: 'MODERATOR', reason: 'Réorganisation' },
        'request-3',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets an administrator grant Pioneer and writes both histories', async () => {
    const { service, transaction } = serviceFor(profile());

    await expect(
      service.changeRole(
        administrator,
        targetId,
        { role: 'PIONEER', reason: 'Membre fondateur' },
        'request-4',
      ),
    ).resolves.toMatchObject({ role: 'PIONEER' });
    expect(transaction.userModerationAction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'PIONEER_GRANTED' }) }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PIONEER_GRANTED', requestId: 'request-4' }),
      }),
    );
  });

  it.each([
    ['suspend', 'ACTIVE', 'SUSPENDED', 'USER_SUSPENDED'],
    ['unsuspend', 'SUSPENDED', 'ACTIVE', 'USER_UNSUSPENDED'],
    ['ban', 'ACTIVE', 'BANNED', 'USER_BANNED'],
    ['unban', 'BANNED', 'ACTIVE', 'USER_UNBANNED'],
  ] as const)(
    '%s updates status transactionally and audits it',
    async (method, current, next, action) => {
      const { service, transaction } = serviceFor(profile({ status: current }));

      await service[method](
        administrator,
        targetId,
        { reason: 'Décision motivée', confirmationUsername: 'target_user' },
        'request-5',
      );

      expect(transaction.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: next }) }),
      );
      expect(transaction.userModerationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action }) }),
      );
      expect(transaction.adminAuditLog.create).toHaveBeenCalled();
    },
  );

  it('updates a username transactionally and audits the before/after state', async () => {
    const { service, transaction } = serviceFor(profile());

    await expect(
      service.updateProfile(
        administrator,
        targetId,
        { username: 'renamed_user' },
        'request-profile',
      ),
    ).resolves.toMatchObject({ username: 'renamed_user' });
    expect(transaction.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'renamed_user',
          normalizedUsername: 'renamed_user',
        }),
      }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'USER_PROFILE_UPDATED' }),
      }),
    );
  });

  it('rejects a duplicate normalized username', async () => {
    const { service, transaction } = serviceFor(profile());
    transaction.userProfile.findFirst.mockResolvedValueOnce({ id: crypto.randomUUID() } as never);

    await expect(
      service.updateProfile(
        administrator,
        targetId,
        { username: 'existing_user' },
        'request-duplicate',
      ),
    ).rejects.toMatchObject({ response: { code: 'USERNAME_ALREADY_EXISTS' } });
    expect(transaction.userProfile.update).not.toHaveBeenCalled();
  });

  it('updates email through Supabase Auth before synchronizing and auditing the profile', async () => {
    const { service, auth, transaction } = serviceFor(profile());

    await service.updateEmail(
      administrator,
      targetId,
      { email: 'new-address@example.com' },
      'request-email',
    );

    expect(auth.updateEmail).toHaveBeenCalledWith(targetId, 'new-address@example.com');
    expect(transaction.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { email: 'new-address@example.com' } }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'USER_EMAIL_UPDATED' }) }),
    );
  });

  it('sends a reset email without exposing a token and records the action', async () => {
    const { service, auth, transaction } = serviceFor(profile());

    await expect(
      service.sendPasswordReset(administrator, targetId, 'request-reset'),
    ).resolves.toEqual({ sent: true });
    expect(auth.sendPasswordReset).toHaveBeenCalledWith('target@example.com');
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PASSWORD_RESET_EMAIL_SENT' }),
      }),
    );
  });

  it('sets a temporary password only in Supabase Auth and stores only the change flag', async () => {
    const { service, auth, transaction } = serviceFor(profile());
    const temporaryPassword = 'Temporary-Secret-71!';

    await service.setTemporaryPassword(
      administrator,
      targetId,
      { temporaryPassword, confirmationUsername: 'target_user' },
      'request-password',
    );

    expect(auth.setTemporaryPassword).toHaveBeenCalledWith(targetId, temporaryPassword);
    expect(transaction.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { mustChangePassword: true } }),
    );
    expect(JSON.stringify(transaction.adminAuditLog.create.mock.calls)).not.toContain(
      temporaryPassword,
    );
  });

  it('creates and revokes warnings without deleting them', async () => {
    const { service, transaction } = serviceFor(profile());

    const created = await service.createWarning(
      administrator,
      targetId,
      { reason: 'Rappel des règles', severity: 'MEDIUM' },
      'request-warning',
    );
    expect(created).toMatchObject({ isActive: true, severityLabel: 'Modéré' });
    await expect(
      service.revokeWarning(
        administrator,
        targetId,
        created.id,
        { reason: 'Avertissement levé' },
        'request-revoke',
      ),
    ).resolves.toMatchObject({ isActive: false });
    expect(transaction.userWarning.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
    expect('delete' in transaction.userWarning).toBe(false);
  });
});

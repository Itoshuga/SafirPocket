import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser, VerifiedAuthUser } from '../common/auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

const loginWriteIntervalMs = 15 * 60 * 1000;

@Injectable()
export class AccountAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(
    identity: VerifiedAuthUser,
    accessToken = '',
    options: { allowDeactivated?: boolean } = {},
  ): Promise<AuthenticatedUser> {
    return this.ensureActive(identity.id, identity.email, accessToken, identity.issuedAt, options);
  }

  async ensureActive(
    userId: string,
    tokenEmail: string | null = null,
    accessToken = '',
    issuedAt: number | null = null,
    options: { allowDeactivated?: boolean } = {},
  ): Promise<AuthenticatedUser> {
    let profile = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!profile) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_PROFILE_MISSING',
        message: 'Le profil applicatif lié à ce compte est introuvable.',
      });
    }

    const now = new Date();
    if (profile.status === 'SUSPENDED' && profile.suspendedUntil && profile.suspendedUntil <= now) {
      const suspendedProfile = profile;
      const suspensionEndedAt = profile.suspendedUntil;
      profile = await this.prisma.runInTransaction(async (transaction) => {
        const updated = await transaction.userProfile.update({
          where: { id: suspendedProfile.id },
          data: { status: 'ACTIVE', suspendedUntil: null },
        });
        await transaction.userModerationAction.create({
          data: {
            targetUserId: suspendedProfile.id,
            actorUserId: null,
            action: 'USER_UNSUSPENDED',
            previousStatus: 'SUSPENDED',
            newStatus: 'ACTIVE',
            reason: 'Expiration automatique de la suspension.',
            metadata: { source: 'ACCOUNT_ACCESS_GUARD' },
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            actorUserId: null,
            entityType: 'USER',
            entityId: suspendedProfile.id,
            action: 'USER_SUSPENSION_EXPIRED',
            beforeData: {
              status: 'SUSPENDED',
              suspendedUntil: suspensionEndedAt.toISOString(),
            },
            afterData: { status: 'ACTIVE', suspendedUntil: null },
          },
        });
        return updated;
      });
    }

    if (profile.status === 'BANNED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_BANNED',
        message: 'Ce compte est banni de Safir Pocket.',
      });
    }
    if (profile.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Ce compte est actuellement suspendu.',
        details: {
          suspendedUntil: profile.suspendedUntil?.toISOString() ?? null,
        },
      });
    }

    if (profile.isDeactivated && !options.allowDeactivated) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Ce compte est désactivé. Confirmez sa réactivation pour continuer.',
        details: {
          deletionScheduledFor: profile.deletionScheduledFor?.toISOString() ?? null,
        },
      });
    }

    if (
      !profile.isDeactivated &&
      (!profile.lastLoginAt ||
        now.getTime() - profile.lastLoginAt.getTime() >= loginWriteIntervalMs)
    ) {
      await this.prisma.userProfile.update({
        where: { id: profile.id },
        data: { lastLoginAt: now },
      });
    }

    return {
      id: profile.id,
      email: tokenEmail ?? profile.email,
      username: profile.username,
      role: profile.role,
      status: 'ACTIVE',
      suspendedUntil: null,
      isDeactivated: profile.isDeactivated,
      accessToken,
      issuedAt,
    };
  }
}

import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccountSecuritySettings } from '@safir/shared-types';
import type {
  AccountDeactivateInput,
  AccountDeletionCancelInput,
  AccountDeletionRequestInput,
  AccountEmailUpdateInput,
  AccountPasswordUpdateInput,
  AccountReactivateInput,
} from '@safir/validation';
import { normalizeUsername } from '@safir/validation';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserProfile } from '../profiles/profile.mapper.js';
import { SupabaseAccountAuthService } from './supabase-account-auth.service.js';

const deletionGracePeriodMs = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: SupabaseAccountAuthService,
  ) {}

  async securitySettings(userId: string): Promise<AccountSecuritySettings> {
    const profile = await this.profile(userId);
    const mapped = toUserProfile(profile);
    return {
      email: profile.email,
      securityEmailsEnabled: true,
      isDeactivated: profile.isDeactivated,
      deactivatedAt: profile.deactivatedAt?.toISOString() ?? null,
      deletion: mapped.deletion,
    };
  }

  async reauthenticate(user: AuthenticatedUser): Promise<{ sent: true }> {
    await this.auth.requestReauthentication(this.accessToken(user));
    return { sent: true };
  }

  async updateEmail(
    user: AuthenticatedUser,
    input: AccountEmailUpdateInput,
  ): Promise<{ confirmationPending: true; email: string }> {
    await this.auth.updateEmail(this.accessToken(user), input.email, input.reauthenticationNonce);
    await this.securityEvent(user.id, 'EMAIL_CHANGE_REQUESTED', {
      emailDomain: input.email.split('@')[1]?.toLowerCase() ?? null,
    });
    return { confirmationPending: true, email: input.email };
  }

  async updatePassword(
    user: AuthenticatedUser,
    input: AccountPasswordUpdateInput,
  ): Promise<{ changed: true }> {
    await this.auth.updatePassword(
      this.accessToken(user),
      input.password,
      input.reauthenticationNonce,
    );
    await this.securityEvent(user.id, 'PASSWORD_CHANGED');
    return { changed: true };
  }

  async revokeSessions(user: AuthenticatedUser): Promise<{ revoked: true }> {
    await this.auth.revokeAllSessions(this.accessToken(user));
    await this.securityEvent(user.id, 'ALL_SESSIONS_REVOKED');
    return { revoked: true };
  }

  async deactivate(
    user: AuthenticatedUser,
    input: AccountDeactivateInput,
  ): Promise<{ deactivated: true }> {
    await this.auth.assertRecentlyAuthenticated(user.id);
    const profile = await this.profile(user.id);
    this.assertUsername(profile.username, input.confirmationUsername);
    if (profile.deletionRequestedAt && !profile.deletionCancelledAt) {
      throw new ConflictException({
        code: 'ACCOUNT_DELETION_ALREADY_SCHEDULED',
        message: 'Une suppression est déjà programmée pour ce compte.',
      });
    }
    if (!profile.isDeactivated) {
      const now = new Date();
      await this.prisma.runInTransaction(async (transaction) => {
        await transaction.userProfile.update({
          where: { id: user.id },
          data: { isDeactivated: true, deactivatedAt: now },
        });
        await transaction.userSecurityEvent.create({
          data: { userId: user.id, eventType: 'ACCOUNT_DEACTIVATED' },
        });
      });
    }
    await this.auth.revokeAllSessions(this.accessToken(user));
    return { deactivated: true };
  }

  async reactivate(
    user: AuthenticatedUser,
    input: AccountReactivateInput,
  ): Promise<{ reactivated: true }> {
    const profile = await this.profile(user.id);
    this.assertUsername(profile.username, input.confirmationUsername);
    if (profile.status === 'BANNED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_BANNED',
        message: 'Un compte banni ne peut pas être réactivé.',
      });
    }
    if (profile.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Ce compte reste suspendu administrativement.',
      });
    }
    if (profile.deletionRequestedAt && !profile.deletionCancelledAt) {
      throw new ConflictException({
        code: 'ACCOUNT_DELETION_CANCELLATION_REQUIRED',
        message: "Annulez d'abord la suppression programmée.",
      });
    }
    if (profile.isDeactivated) {
      await this.prisma.runInTransaction(async (transaction) => {
        await transaction.userProfile.update({
          where: { id: user.id },
          data: { isDeactivated: false, deactivatedAt: null },
        });
        await transaction.userSecurityEvent.create({
          data: { userId: user.id, eventType: 'ACCOUNT_REACTIVATED' },
        });
      });
    }
    return { reactivated: true };
  }

  async requestDeletion(
    user: AuthenticatedUser,
    input: AccountDeletionRequestInput,
  ): Promise<AccountSecuritySettings> {
    await this.auth.assertRecentlyAuthenticated(user.id);
    const profile = await this.profile(user.id);
    this.assertUsername(profile.username, input.confirmationUsername);
    if (profile.deletionProcessedAt) {
      throw new ConflictException({
        code: 'ACCOUNT_DELETION_ALREADY_PROCESSED',
        message: 'La suppression de ce compte a déjà été traitée.',
      });
    }
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + deletionGracePeriodMs);
    await this.prisma.runInTransaction(async (transaction) => {
      await transaction.userProfile.update({
        where: { id: user.id },
        data: {
          isDeactivated: true,
          deactivatedAt: now,
          deletionRequestedAt: now,
          deletionScheduledFor: scheduledFor,
          deletionCancelledAt: null,
          deletionReason: input.reason,
        },
      });
      await transaction.userSecurityEvent.create({
        data: {
          userId: user.id,
          eventType: 'ACCOUNT_DELETION_REQUESTED',
          metadata: {
            scheduledFor: scheduledFor.toISOString(),
            reasonProvided: Boolean(input.reason),
          },
        },
      });
    });
    await this.auth.revokeAllSessions(this.accessToken(user));
    return this.securitySettings(user.id);
  }

  async cancelDeletion(
    user: AuthenticatedUser,
    input: AccountDeletionCancelInput,
  ): Promise<AccountSecuritySettings> {
    const profile = await this.profile(user.id);
    this.assertUsername(profile.username, input.confirmationUsername);
    if (profile.deletionProcessedAt) {
      throw new ConflictException({
        code: 'ACCOUNT_DELETION_ALREADY_PROCESSED',
        message: 'La suppression définitive a déjà été traitée.',
      });
    }
    if (
      !profile.deletionRequestedAt ||
      profile.deletionCancelledAt ||
      !profile.deletionScheduledFor
    ) {
      throw new NotFoundException({
        code: 'ACCOUNT_DELETION_NOT_SCHEDULED',
        message: "Aucune suppression active n'est programmée.",
      });
    }
    if (profile.deletionScheduledFor <= new Date()) {
      throw new ConflictException({
        code: 'ACCOUNT_DELETION_GRACE_PERIOD_EXPIRED',
        message: "La période d'annulation est terminée.",
      });
    }
    await this.prisma.runInTransaction(async (transaction) => {
      const now = new Date();
      await transaction.userProfile.update({
        where: { id: user.id },
        data: {
          isDeactivated: false,
          deactivatedAt: null,
          deletionCancelledAt: now,
          deletionReason: null,
        },
      });
      await transaction.userSecurityEvent.create({
        data: { userId: user.id, eventType: 'ACCOUNT_DELETION_CANCELLED' },
      });
    });
    return this.securitySettings(user.id);
  }

  async processDueDeletions(batchSize = 25): Promise<{ processed: number; failed: number }> {
    const due = await this.prisma.userProfile.findMany({
      where: {
        deletionRequestedAt: { not: null },
        deletionScheduledFor: { lte: new Date() },
        deletionCancelledAt: null,
        deletionProcessedAt: null,
      },
      orderBy: { deletionScheduledFor: 'asc' },
      take: Math.min(Math.max(batchSize, 1), 100),
    });
    let processed = 0;
    let failed = 0;
    for (const profile of due) {
      try {
        await this.auth.removeProfileMedia(profile.id);
        await this.anonymize(profile.id);
        await this.auth.deleteAuthUser(profile.id);
        const accountHash = createHash('sha256').update(profile.id).digest('hex');
        await this.prisma.runInTransaction(async (transaction) => {
          await transaction.userProfile.update({
            where: { id: profile.id },
            data: { deletionProcessedAt: new Date() },
          });
          await transaction.userSecurityEvent.create({
            data: {
              userId: null,
              eventType: 'ACCOUNT_DELETION_PROCESSED',
              metadata: { accountHash },
            },
          });
        });
        processed += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed, failed };
  }

  private async anonymize(userId: string): Promise<void> {
    const suffix = userId.replaceAll('-', '').slice(0, 12);
    await this.prisma.runInTransaction(async (transaction) => {
      await transaction.friendRequest.deleteMany({
        where: { OR: [{ senderUserId: userId }, { receiverUserId: userId }] },
      });
      await transaction.friendship.deleteMany({
        where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
      });
      await transaction.userBlock.deleteMany({
        where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
      });
      await transaction.userPreference.deleteMany({ where: { userId } });
      await transaction.deck.deleteMany({ where: { ownerId: userId } });
      await transaction.userCard.deleteMany({ where: { userId } });
      await transaction.userMission.deleteMany({ where: { userId } });
      await transaction.wallet.deleteMany({ where: { userId } });
      await transaction.rankedRating.deleteMany({ where: { userId } });
      await transaction.userSecurityEvent.updateMany({
        where: { userId },
        data: { userId: null, metadata: { anonymized: true } },
      });
      await transaction.adminAuditLog.updateMany({
        where: { actorUserId: userId },
        data: { actorUserId: null },
      });
      await transaction.userProfile.update({
        where: { id: userId },
        data: {
          username: `deleted_${suffix}`,
          normalizedUsername: `deleted_${suffix}`,
          email: `${suffix}@deleted.invalid`,
          displayName: null,
          avatarUrl: null,
          bannerUrl: null,
          bannerPositionY: 50,
          bio: null,
          role: 'USER',
          mustChangePassword: false,
          deletionReason: null,
        },
      });
    });
  }

  private profile(userId: string) {
    return this.prisma.userProfile.findUnique({ where: { id: userId } }).then((profile) => {
      if (!profile) {
        throw new NotFoundException({
          code: 'PROFILE_NOT_FOUND',
          message: 'Profil introuvable.',
        });
      }
      return profile;
    });
  }

  private assertUsername(actual: string, confirmation: string): void {
    if (normalizeUsername(actual) !== normalizeUsername(confirmation)) {
      throw new ForbiddenException({
        code: 'ACCOUNT_CONFIRMATION_INVALID',
        message: "Le nom d'utilisateur de confirmation ne correspond pas.",
        fieldErrors: {
          confirmationUsername: ["Le nom d'utilisateur ne correspond pas."],
        },
      });
    }
  }

  private accessToken(user: AuthenticatedUser): string {
    if (!user.accessToken) {
      throw new ForbiddenException({
        code: 'SESSION_TOKEN_UNAVAILABLE',
        message: 'La session ne permet pas cette action sensible.',
      });
    }
    return user.accessToken;
  }

  private securityEvent(
    userId: string,
    eventType: string,
    metadata: Record<string, unknown> = {},
  ): Promise<unknown> {
    return this.prisma.userSecurityEvent.create({
      data: { userId, eventType, metadata: metadata as Prisma.InputJsonValue },
    });
  }
}

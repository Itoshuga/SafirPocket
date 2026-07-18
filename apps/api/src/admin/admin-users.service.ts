import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  WARNING_SEVERITY_LABELS,
  type AccountStatus,
  type ModerationActionType,
  type UserWarning,
} from '@safir/shared-types';
import {
  normalizeUsername,
  type AdminUserEmailUpdateInput,
  type AdminUserProfileUpdateInput,
  type AdminUsersQuery,
  type BanInput,
  type ModerationInput,
  type RoleChangeInput,
  type TemporaryPasswordInput,
  type WarningCreateInput,
  type WarningHistoryQuery,
  type WarningRevokeInput,
} from '@safir/validation';
import type { Prisma, UserProfile as DatabaseUserProfile } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { rethrowPrismaConstraint } from '../common/errors/prisma-error.js';
import { PrismaService, type PrismaTransactionClient } from '../prisma/prisma.service.js';
import { toUserProfile } from '../profiles/profile.mapper.js';
import { SupabaseAdminAuthService } from './supabase-admin-auth.service.js';

const moderationInclude = {
  actor: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.UserModerationActionInclude;

const warningInclude = {
  issuedBy: { select: { id: true, username: true, displayName: true } },
  revokedBy: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.UserWarningInclude;

const auditInclude = {
  actor: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.AdminAuditLogInclude;

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: SupabaseAdminAuthService,
  ) {}

  async list(query: AdminUsersQuery) {
    const where: Prisma.UserProfileWhereInput = {
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [profiles, total] = await this.prisma.$transaction([
      this.prisma.userProfile.findMany({
        where,
        orderBy: this.userOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.userProfile.count({ where }),
    ]);
    return {
      data: profiles.map(toUserProfile),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async details(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!profile) this.userNotFound();
    const [activeWarningsCount, totalWarningsCount, latestModerationActions] = await Promise.all([
      this.prisma.userWarning.count({ where: { userId, isActive: true } }),
      this.prisma.userWarning.count({ where: { userId } }),
      this.prisma.userModerationAction.findMany({
        where: { targetUserId: userId },
        include: moderationInclude,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return {
      ...toUserProfile(profile),
      activeWarningsCount,
      totalWarningsCount,
      latestModerationActions: latestModerationActions.map((action) =>
        this.toModerationAction(action),
      ),
    };
  }

  async history(userId: string) {
    await this.requireUser(this.prisma, userId);
    const actions = await this.prisma.userModerationAction.findMany({
      where: { targetUserId: userId },
      include: moderationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return actions.map((action) => this.toModerationAction(action));
  }

  async auditLogs(userId: string) {
    await this.requireUser(this.prisma, userId);
    const entries = await this.prisma.adminAuditLog.findMany({
      where: { entityType: 'USER', entityId: userId },
      include: auditInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  async warnings(userId: string, query: WarningHistoryQuery) {
    await this.requireUser(this.prisma, userId);
    const warnings = await this.prisma.userWarning.findMany({
      where: {
        userId,
        ...(query.status === 'active'
          ? { isActive: true }
          : query.status === 'revoked'
            ? { isActive: false }
            : {}),
      },
      include: warningInclude,
      orderBy: { createdAt: 'desc' },
    });
    return warnings.map((warning) => this.toWarning(warning));
  }

  async updateProfile(
    actor: AuthenticatedUser,
    userId: string,
    input: AdminUserProfileUpdateInput,
    requestId: string,
  ) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        const target = await this.requireUser(transaction, userId);
        this.assertCanManageProfile(actor, target);
        const normalizedUsername = input.username
          ? normalizeUsername(input.username)
          : target.normalizedUsername;
        if (input.username) {
          const duplicate = await transaction.userProfile.findFirst({
            where: { normalizedUsername, id: { not: target.id } },
            select: { id: true },
          });
          if (duplicate) this.usernameConflict();
        }
        const updated = await transaction.userProfile.update({
          where: { id: target.id },
          data: {
            ...(input.username !== undefined
              ? { username: input.username, normalizedUsername }
              : {}),
            ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
            ...(input.bio !== undefined ? { bio: input.bio } : {}),
            ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
          },
        });
        await this.audit(
          transaction,
          actor.id,
          target.id,
          'USER_PROFILE_UPDATED',
          requestId,
          {
            username: target.username,
            displayName: target.displayName,
            bio: target.bio,
            avatarUrl: target.avatarUrl,
          },
          {
            username: updated.username,
            displayName: updated.displayName,
            bio: updated.bio,
            avatarUrl: updated.avatarUrl,
          },
        );
        return toUserProfile(updated);
      });
    } catch (error) {
      rethrowPrismaConstraint(error, [
        {
          matches: ['normalized_username', 'user_profiles_normalized_username_key'],
          code: 'USERNAME_ALREADY_EXISTS',
          message: "Ce nom d'utilisateur est déjà utilisé.",
          fieldErrors: { username: ["Ce nom d'utilisateur est déjà utilisé."] },
        },
      ]);
    }
  }

  async updateEmail(
    actor: AuthenticatedUser,
    userId: string,
    input: AdminUserEmailUpdateInput,
    requestId: string,
  ) {
    const target = await this.requireUser(this.prisma, userId);
    this.assertCanManageProfile(actor, target);
    if (target.email.toLowerCase() === input.email.toLowerCase()) {
      throw new ConflictException({
        code: 'EMAIL_UNCHANGED',
        message: 'Cette adresse e-mail est déjà celle du compte.',
      });
    }
    const duplicate = await this.prisma.userProfile.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' }, id: { not: target.id } },
      select: { id: true },
    });
    if (duplicate) this.emailConflict();

    let authUpdated = false;
    try {
      await this.auth.updateEmail(target.id, input.email);
      authUpdated = true;
      const updated = await this.prisma.runInTransaction(async (transaction) => {
        const profile = await transaction.userProfile.update({
          where: { id: target.id },
          data: { email: input.email },
        });
        await this.audit(
          transaction,
          actor.id,
          target.id,
          'USER_EMAIL_UPDATED',
          requestId,
          {
            email: target.email,
          },
          {
            email: profile.email,
          },
        );
        return profile;
      });
      return toUserProfile(updated);
    } catch (error) {
      if (authUpdated) {
        try {
          await this.auth.updateEmail(target.id, target.email);
        } catch {
          this.logger.error({ userId: target.id, requestId }, 'email compensation failed');
          throw new InternalServerErrorException({
            code: 'EMAIL_SYNC_REPAIR_REQUIRED',
            message:
              "L'adresse Auth a changé, mais sa synchronisation doit être réparée par un administrateur.",
          });
        }
      }
      rethrowPrismaConstraint(error, [
        {
          matches: ['email', 'user_profiles_email_lower_key'],
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Cette adresse e-mail est déjà utilisée.',
          fieldErrors: { email: ['Cette adresse e-mail est déjà utilisée.'] },
        },
      ]);
    }
  }

  async sendPasswordReset(
    actor: AuthenticatedUser,
    userId: string,
    requestId: string,
  ): Promise<{ sent: true }> {
    const target = await this.requireUser(this.prisma, userId);
    this.assertCanManageProfile(actor, target);
    try {
      await this.auth.sendPasswordReset(target.email);
    } catch (error) {
      await this.writeSecurityAudit(actor.id, target.id, 'PASSWORD_RESET_EMAIL_FAILED', requestId);
      throw error;
    }
    await this.writeSecurityAudit(actor.id, target.id, 'PASSWORD_RESET_EMAIL_SENT', requestId);
    return { sent: true };
  }

  async setTemporaryPassword(
    actor: AuthenticatedUser,
    userId: string,
    input: TemporaryPasswordInput,
    requestId: string,
  ): Promise<{ updated: true; mustChangePassword: true }> {
    const target = await this.requireUser(this.prisma, userId);
    this.assertCanManageProfile(actor, target);
    if (actor.id === target.id) {
      throw new ForbiddenException({
        code: 'CANNOT_RESET_OWN_PASSWORD',
        message: 'Utilisez le parcours personnel pour modifier votre propre mot de passe.',
      });
    }
    if (normalizeUsername(input.confirmationUsername) !== target.normalizedUsername) {
      throw new BadRequestException({
        code: 'CONFIRMATION_USERNAME_MISMATCH',
        message: "Le nom d'utilisateur de confirmation ne correspond pas.",
        fieldErrors: { confirmationUsername: ["Le nom d'utilisateur ne correspond pas."] },
      });
    }
    await this.auth.setTemporaryPassword(target.id, input.temporaryPassword);
    try {
      await this.prisma.runInTransaction(async (transaction) => {
        await transaction.userProfile.update({
          where: { id: target.id },
          data: { mustChangePassword: true },
        });
        await this.audit(
          transaction,
          actor.id,
          target.id,
          'TEMPORARY_PASSWORD_SET',
          requestId,
          { mustChangePassword: target.mustChangePassword },
          { mustChangePassword: true },
        );
      });
    } catch {
      this.logger.error({ userId: target.id, requestId }, 'temporary password sync failed');
      throw new InternalServerErrorException({
        code: 'PASSWORD_SYNC_REPAIR_REQUIRED',
        message:
          'Le mot de passe a été modifié, mais le suivi applicatif nécessite une réparation.',
      });
    }
    return { updated: true, mustChangePassword: true };
  }

  async createWarning(
    actor: AuthenticatedUser,
    userId: string,
    input: WarningCreateInput,
    requestId: string,
  ): Promise<UserWarning> {
    return this.prisma.runInTransaction(async (transaction) => {
      const target = await this.requireUser(transaction, userId);
      this.assertCanModerate(actor, target);
      const warning = await transaction.userWarning.create({
        data: {
          userId: target.id,
          issuedByUserId: actor.id,
          reason: input.reason,
          internalNote: input.internalNote,
          severity: input.severity,
        },
        include: warningInclude,
      });
      await this.audit(transaction, actor.id, target.id, 'USER_WARNING_ISSUED', requestId, null, {
        warningId: warning.id,
        severity: warning.severity,
        reason: warning.reason,
      });
      return this.toWarning(warning);
    });
  }

  async revokeWarning(
    actor: AuthenticatedUser,
    userId: string,
    warningId: string,
    input: WarningRevokeInput,
    requestId: string,
  ): Promise<UserWarning> {
    return this.prisma.runInTransaction(async (transaction) => {
      const target = await this.requireUser(transaction, userId);
      this.assertCanModerate(actor, target);
      const existing = await transaction.userWarning.findFirst({
        where: { id: warningId, userId: target.id },
        include: warningInclude,
      });
      if (!existing) this.warningNotFound();
      if (!existing.isActive) {
        throw new ConflictException({
          code: 'WARNING_ALREADY_REVOKED',
          message: 'Cet avertissement a déjà été révoqué.',
        });
      }
      const warning = await transaction.userWarning.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedByUserId: actor.id,
        },
        include: warningInclude,
      });
      await this.audit(
        transaction,
        actor.id,
        target.id,
        'USER_WARNING_REVOKED',
        requestId,
        {
          warningId: existing.id,
          isActive: true,
        },
        {
          warningId: warning.id,
          isActive: false,
          reason: input.reason,
          internalNote: input.internalNote ?? null,
        },
      );
      return this.toWarning(warning);
    });
  }

  suspend(actor: AuthenticatedUser, userId: string, input: ModerationInput, requestId: string) {
    const suspendedUntil = input.suspendedUntil ? new Date(input.suspendedUntil) : null;
    if (suspendedUntil && suspendedUntil <= new Date()) {
      throw new ConflictException({
        code: 'SUSPENSION_END_INVALID',
        message: 'La fin de suspension doit être située dans le futur.',
        fieldErrors: { suspendedUntil: ['Choisissez une date future.'] },
      });
    }
    return this.changeStatus(
      actor,
      userId,
      'SUSPENDED',
      'USER_SUSPENDED',
      input,
      requestId,
      suspendedUntil,
    );
  }

  unsuspend(actor: AuthenticatedUser, userId: string, input: ModerationInput, requestId: string) {
    return this.changeStatus(
      actor,
      userId,
      'ACTIVE',
      'USER_UNSUSPENDED',
      input,
      requestId,
      null,
      'SUSPENDED',
    );
  }

  ban(actor: AuthenticatedUser, userId: string, input: BanInput, requestId: string) {
    return this.changeStatus(
      actor,
      userId,
      'BANNED',
      'USER_BANNED',
      input,
      requestId,
      null,
      undefined,
      input.confirmationUsername,
    );
  }

  unban(actor: AuthenticatedUser, userId: string, input: ModerationInput, requestId: string) {
    return this.changeStatus(
      actor,
      userId,
      'ACTIVE',
      'USER_UNBANNED',
      input,
      requestId,
      null,
      'BANNED',
    );
  }

  async changeRole(
    actor: AuthenticatedUser,
    userId: string,
    input: RoleChangeInput,
    requestId: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const target = await this.requireUser(transaction, userId);
      this.assertCanManageProfile(actor, target);
      if (actor.id === target.id) {
        if (normalizeUsername(input.confirmationUsername ?? '') !== target.normalizedUsername) {
          throw new BadRequestException({
            code: 'CONFIRMATION_USERNAME_MISMATCH',
            message: "Confirmez cette action avec votre nom d'utilisateur.",
            fieldErrors: {
              confirmationUsername: ["Le nom d'utilisateur ne correspond pas."],
            },
          });
        }
      }
      if (target.role === input.role) {
        throw new ConflictException({
          code: 'ROLE_UNCHANGED',
          message: 'Cet utilisateur possède déjà ce rôle.',
        });
      }
      if (target.role === 'ADMINISTRATOR' && input.role !== 'ADMINISTRATOR') {
        await this.assertNotLastAdministrator(transaction, target.id);
      }
      const action: ModerationActionType =
        input.role === 'PIONEER'
          ? 'PIONEER_GRANTED'
          : target.role === 'PIONEER'
            ? 'PIONEER_REVOKED'
            : 'ROLE_CHANGED';
      const updated = await transaction.userProfile.update({
        where: { id: target.id },
        data: { role: input.role },
      });
      await transaction.userModerationAction.create({
        data: {
          targetUserId: target.id,
          actorUserId: actor.id,
          action,
          previousRole: target.role,
          newRole: input.role,
          reason: input.reason,
          internalNote: input.internalNote,
        },
      });
      await this.audit(
        transaction,
        actor.id,
        target.id,
        action,
        requestId,
        {
          role: target.role,
        },
        {
          role: input.role,
        },
      );
      return toUserProfile(updated);
    });
  }

  private async changeStatus(
    actor: AuthenticatedUser,
    userId: string,
    nextStatus: AccountStatus,
    action: ModerationActionType,
    input: ModerationInput,
    requestId: string,
    suspendedUntil: Date | null,
    requiredCurrentStatus?: AccountStatus,
    confirmationUsername?: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const target = await this.requireUser(transaction, userId);
      this.assertCanModerate(actor, target);
      if (
        confirmationUsername !== undefined &&
        normalizeUsername(confirmationUsername) !== target.normalizedUsername
      ) {
        throw new BadRequestException({
          code: 'CONFIRMATION_USERNAME_MISMATCH',
          message: "Le nom d'utilisateur de confirmation ne correspond pas.",
          fieldErrors: { confirmationUsername: ["Le nom d'utilisateur ne correspond pas."] },
        });
      }
      if (requiredCurrentStatus && target.status !== requiredCurrentStatus) {
        throw new ConflictException({
          code: 'ACCOUNT_STATUS_CONFLICT',
          message: "L'état actuel du compte ne permet pas cette action.",
        });
      }
      if (target.status === nextStatus && nextStatus !== 'SUSPENDED') {
        throw new ConflictException({
          code: 'ACCOUNT_STATUS_UNCHANGED',
          message: 'Ce compte possède déjà ce statut.',
        });
      }
      if (target.role === 'ADMINISTRATOR' && nextStatus !== 'ACTIVE') {
        await this.assertNotLastAdministrator(transaction, target.id);
      }
      const updated = await transaction.userProfile.update({
        where: { id: target.id },
        data: {
          status: nextStatus,
          suspendedUntil: nextStatus === 'SUSPENDED' ? suspendedUntil : null,
        },
      });
      await transaction.userModerationAction.create({
        data: {
          targetUserId: target.id,
          actorUserId: actor.id,
          action,
          previousStatus: target.status,
          newStatus: nextStatus,
          reason: input.reason,
          internalNote: input.internalNote,
          metadata: suspendedUntil ? { suspendedUntil: suspendedUntil.toISOString() } : {},
        },
      });
      await this.audit(
        transaction,
        actor.id,
        target.id,
        action,
        requestId,
        {
          status: target.status,
          suspendedUntil: target.suspendedUntil?.toISOString() ?? null,
        },
        {
          status: nextStatus,
          suspendedUntil: suspendedUntil?.toISOString() ?? null,
        },
      );
      return toUserProfile(updated);
    });
  }

  private assertCanManageProfile(actor: AuthenticatedUser, target: DatabaseUserProfile): void {
    if (
      actor.role === 'MODERATOR' &&
      (actor.id === target.id || !['USER', 'PIONEER'].includes(target.role))
    ) {
      throw new ForbiddenException({
        code: 'CANNOT_MANAGE_HIGHER_ROLE',
        message: 'Un modérateur ne peut pas gérer ce compte.',
      });
    }
  }

  private assertCanModerate(actor: AuthenticatedUser, target: DatabaseUserProfile): void {
    if (actor.id === target.id) {
      throw new ForbiddenException({
        code: 'CANNOT_MODERATE_SELF',
        message: 'Une action de modération ne peut pas cibler votre propre compte.',
      });
    }
    if (actor.role === 'MODERATOR' && !['USER', 'PIONEER'].includes(target.role)) {
      throw new ForbiddenException({
        code: 'CANNOT_MODERATE_HIGHER_ROLE',
        message: 'Un modérateur ne peut pas agir sur ce rôle.',
      });
    }
  }

  private async assertNotLastAdministrator(
    transaction: PrismaTransactionClient,
    targetId: string,
  ): Promise<void> {
    const otherActiveAdministrators = await transaction.userProfile.count({
      where: { id: { not: targetId }, role: 'ADMINISTRATOR', status: 'ACTIVE' },
    });
    if (otherActiveAdministrators === 0) {
      throw new ConflictException({
        code: 'LAST_ADMIN_PROTECTION',
        message: 'Le dernier administrateur actif doit conserver son accès.',
      });
    }
  }

  private async requireUser(
    transaction: PrismaTransactionClient | PrismaService,
    userId: string,
  ): Promise<DatabaseUserProfile> {
    const profile = await transaction.userProfile.findUnique({ where: { id: userId } });
    if (!profile) this.userNotFound();
    return profile;
  }

  private writeSecurityAudit(
    actorUserId: string,
    entityId: string,
    action: string,
    requestId: string,
  ) {
    return this.prisma.runInTransaction((transaction) =>
      this.audit(transaction, actorUserId, entityId, action, requestId, null, {
        completed: action.endsWith('_SENT'),
      }),
    );
  }

  private audit(
    transaction: PrismaTransactionClient,
    actorUserId: string,
    entityId: string,
    action: string,
    requestId: string,
    beforeData: Prisma.InputJsonValue | null,
    afterData: Prisma.InputJsonValue | null,
  ) {
    return transaction.adminAuditLog.create({
      data: {
        actorUserId,
        entityType: 'USER',
        entityId,
        action,
        requestId,
        ...(beforeData === null ? {} : { beforeData }),
        ...(afterData === null ? {} : { afterData }),
      },
    });
  }

  private toModerationAction(
    action: Prisma.UserModerationActionGetPayload<{ include: typeof moderationInclude }>,
  ) {
    return { ...action, createdAt: action.createdAt.toISOString() };
  }

  private toWarning(
    warning: Prisma.UserWarningGetPayload<{ include: typeof warningInclude }>,
  ): UserWarning {
    return {
      id: warning.id,
      userId: warning.userId,
      issuedByUserId: warning.issuedByUserId,
      reason: warning.reason,
      internalNote: warning.internalNote,
      severity: warning.severity,
      severityLabel: WARNING_SEVERITY_LABELS[warning.severity],
      isActive: warning.isActive,
      acknowledgedAt: warning.acknowledgedAt?.toISOString() ?? null,
      revokedAt: warning.revokedAt?.toISOString() ?? null,
      revokedByUserId: warning.revokedByUserId,
      createdAt: warning.createdAt.toISOString(),
      updatedAt: warning.updatedAt.toISOString(),
      issuedBy: warning.issuedBy,
      revokedBy: warning.revokedBy,
    };
  }

  private usernameConflict(): never {
    throw new ConflictException({
      code: 'USERNAME_ALREADY_EXISTS',
      message: "Ce nom d'utilisateur est déjà utilisé.",
      fieldErrors: { username: ["Ce nom d'utilisateur est déjà utilisé."] },
    });
  }

  private emailConflict(): never {
    throw new ConflictException({
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Cette adresse e-mail est déjà utilisée.',
      fieldErrors: { email: ['Cette adresse e-mail est déjà utilisée.'] },
    });
  }

  private userNotFound(): never {
    throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable.' });
  }

  private warningNotFound(): never {
    throw new NotFoundException({
      code: 'WARNING_NOT_FOUND',
      message: 'Avertissement introuvable.',
    });
  }

  private userOrderBy(sort: AdminUsersQuery['sort']): Prisma.UserProfileOrderByWithRelationInput {
    switch (sort) {
      case 'createdAt':
        return { createdAt: 'asc' };
      case 'username':
        return { username: 'asc' };
      case '-username':
        return { username: 'desc' };
      case 'lastLoginAt':
        return { lastLoginAt: { sort: 'asc', nulls: 'last' } };
      case '-lastLoginAt':
        return { lastLoginAt: { sort: 'desc', nulls: 'last' } };
      default:
        return { createdAt: 'desc' };
    }
  }
}

import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, type UserProfile } from '@safir/shared-types';
import type { UserProfile as DatabaseUserProfile } from '../generated/prisma/client.js';

export function toUserProfile(profile: DatabaseUserProfile): UserProfile {
  const usernameChangeAvailableAt = profile.usernameChangedAt
    ? new Date(profile.usernameChangedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;
  const deletionState = profile.deletionProcessedAt
    ? 'PROCESSED'
    : profile.deletionCancelledAt
      ? 'CANCELLED'
      : profile.deletionRequestedAt
        ? 'SCHEDULED'
        : 'NONE';
  return {
    id: profile.id,
    username: profile.username,
    normalizedUsername: profile.normalizedUsername,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    role: profile.role,
    roleLabel: ROLE_LABELS[profile.role],
    status: profile.status,
    statusLabel: ACCOUNT_STATUS_LABELS[profile.status],
    suspendedUntil: profile.suspendedUntil?.toISOString() ?? null,
    mustChangePassword: profile.mustChangePassword,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
    usernameChangedAt: profile.usernameChangedAt?.toISOString() ?? null,
    usernameChangeAvailableAt: usernameChangeAvailableAt?.toISOString() ?? null,
    isDeactivated: profile.isDeactivated,
    deactivatedAt: profile.deactivatedAt?.toISOString() ?? null,
    deletion: {
      state: deletionState,
      requestedAt: profile.deletionRequestedAt?.toISOString() ?? null,
      scheduledFor: profile.deletionScheduledFor?.toISOString() ?? null,
      cancelledAt: profile.deletionCancelledAt?.toISOString() ?? null,
      processedAt: profile.deletionProcessedAt?.toISOString() ?? null,
    },
  };
}

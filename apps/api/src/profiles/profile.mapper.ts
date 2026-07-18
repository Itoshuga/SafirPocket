import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, type UserProfile } from '@safir/shared-types';
import type { UserProfile as DatabaseUserProfile } from '../generated/prisma/client.js';

export function toUserProfile(profile: DatabaseUserProfile): UserProfile {
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
  };
}

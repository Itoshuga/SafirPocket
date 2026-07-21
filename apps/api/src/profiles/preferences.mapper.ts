import type { UserPreferences } from '@safir/shared-types';
import type { UserPreference } from '../generated/prisma/client.js';

export function toUserPreferences(preferences: UserPreference): UserPreferences {
  return {
    userId: preferences.userId,
    profileVisibility: preferences.profileVisibility,
    collectionVisibility: preferences.collectionVisibility,
    allowFriendRequests: preferences.allowFriendRequests,
    appearInUserSearch: preferences.appearInUserSearch,
    showOnlineStatus: preferences.showOnlineStatus,
    showCollectionStats: preferences.showCollectionStats,
    showCardQuantities: preferences.showCardQuantities,
    showCollectionCompletion: preferences.showCollectionCompletion,
    showGameStats: preferences.showGameStats,
    emailNotifications: preferences.emailNotifications,
    friendRequestNotifications: preferences.friendRequestNotifications,
    friendAcceptanceNotifications: preferences.friendAcceptanceNotifications,
    gameInviteNotifications: preferences.gameInviteNotifications,
    gameNewsNotifications: preferences.gameNewsNotifications,
    marketingEmails: preferences.marketingEmails,
    createdAt: preferences.createdAt.toISOString(),
    updatedAt: preferences.updatedAt.toISOString(),
  };
}

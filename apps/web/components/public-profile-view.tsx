'use client';

import type { PublicProfileStats, PublicUserProfile } from '@safir/shared-types';
import { ErrorState, Panel, Skeleton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ProfileCollectionBySeason } from './profile-collection-by-season';
import { ProfileSocialActions } from './profile-social-actions';
import { ProfileSocialStats, type ProfileSocialStatItem } from './profile-social-stats';
import { SocialProfileHeader } from './social-profile-header';

export function PublicProfileView({ username }: { username: string }) {
  const profile = useQuery({
    queryKey: queryKeys.publicProfile(username),
    queryFn: () =>
      apiFetch<PublicUserProfile>(`/api/v1/users/${encodeURIComponent(username)}/public-profile`),
    retry: false,
  });
  const stats = useQuery({
    queryKey: queryKeys.publicProfileStats(username),
    queryFn: () =>
      apiFetch<PublicProfileStats>(`/api/v1/users/${encodeURIComponent(username)}/profile-stats`),
    enabled: Boolean(profile.data?.permissions.canViewStats),
    retry: false,
  });

  if (profile.isLoading) return <Skeleton className="h-80 w-full" />;
  if (profile.isError || !profile.data) {
    return <ErrorState title="Profil indisponible" message="Ce profil n'est pas accessible." />;
  }

  const data = profile.data;
  const statItems: ProfileSocialStatItem[] = stats.data
    ? [
        ...(stats.data.uniqueCardsCount !== undefined
          ? [{ label: 'Cartes uniques', value: stats.data.uniqueCardsCount }]
          : []),
        ...(stats.data.totalCardsCount !== undefined
          ? [{ label: 'Cartes totales', value: stats.data.totalCardsCount }]
          : []),
        ...(stats.data.decksCount !== undefined
          ? [{ label: 'Decks', value: stats.data.decksCount }]
          : []),
        { label: 'Amis', value: stats.data.friendsCount },
      ]
    : [];

  return (
    <div className="space-y-7">
      <SocialProfileHeader
        profile={data}
        visibility={data.profileVisibility}
        friendsCount={stats.data?.friendsCount}
        limited={!data.permissions.canViewProfile}
        actions={
          <ProfileSocialActions
            username={data.username}
            status={data.friendship.status}
            permissions={data.permissions}
          />
        }
      />
      {!data.permissions.canViewProfile ? (
        <Panel className="py-12 text-center" role="status">
          <LockKeyhole className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-sm font-medium text-foreground">Ce profil est privé.</p>
        </Panel>
      ) : (
        <>
          {stats.isError ? (
            <ErrorState message="Les statistiques publiques ne sont pas disponibles." />
          ) : (
            <ProfileSocialStats
              loading={stats.isLoading}
              items={statItems}
              completion={stats.data?.collectionCompletionPercentage}
            />
          )}
          <ProfileCollectionBySeason
            username={data.username}
            ownProfile={false}
            visibility={data.collectionVisibility}
            permissions={data.permissions}
          />
        </>
      )}
    </div>
  );
}

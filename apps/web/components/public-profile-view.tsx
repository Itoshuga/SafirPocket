'use client';

import type { PublicProfileStats, PublicUserProfile } from '@safir/shared-types';
import { Button, ErrorState, Panel, Skeleton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { profileQueryKeys, queryKeys } from '@/lib/query-keys';
import { ProfileCollectionBySeason } from './profile-collection-by-season';
import { ProfileSocialActions } from './profile-social-actions';
import { ProfileStatsOverview, ProfileStatsSkeleton } from './profile-stats-overview';
import { SocialProfileHeader } from './social-profile-header';

export function PublicProfileView({ username }: { username: string }) {
  const profile = useQuery({
    queryKey: queryKeys.publicProfile(username),
    queryFn: () =>
      apiFetch<PublicUserProfile>(`/api/v1/users/${encodeURIComponent(username)}/public-profile`),
    retry: false,
  });
  const stats = useQuery({
    queryKey: profileQueryKeys.stats.public(username),
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
  return (
    <div className="space-y-7">
      <SocialProfileHeader
        profile={data}
        visibility={data.profileVisibility}
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
          {stats.isLoading ? <ProfileStatsSkeleton /> : null}
          {stats.isError ? (
            <section className="border-y border-border bg-surface px-4 py-5" role="alert">
              <p className="text-sm font-medium text-foreground">
                Impossible de charger les statistiques.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 px-0"
                onClick={() => void stats.refetch()}
              >
                <RefreshCw className="size-4" /> Réessayer
              </Button>
            </section>
          ) : null}
          {stats.data ? <ProfileStatsOverview stats={stats.data} ownProfile={false} /> : null}
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

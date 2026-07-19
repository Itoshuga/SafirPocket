'use client';

import type { PublicUserProfile } from '@safir/shared-types';
import { Avatar, Badge, ErrorState, Panel, SectionHeader, Skeleton, StatCard } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { queryKeys } from '@/lib/query-keys';

export function PublicProfileView({ username }: { username: string }) {
  const profile = useQuery({
    queryKey: queryKeys.publicProfile(username),
    queryFn: () =>
      apiFetch<PublicUserProfile>(`/api/v1/users/${encodeURIComponent(username)}/public-profile`),
    retry: false,
  });
  if (profile.isLoading) return <Skeleton className="h-[28rem]" />;
  if (profile.isError || !profile.data) {
    return <ErrorState title="Profil indisponible" message="Ce profil n'est pas accessible." />;
  }
  if (profile.data.profileVisibility === 'PRIVATE') {
    return (
      <Panel className="py-12 text-center">
        <LockKeyhole className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">@{profile.data.username}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ce profil est privé.</p>
      </Panel>
    );
  }
  const stats = profile.data.publicStats;
  return (
    <div className="space-y-8">
      <Panel>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar
            src={resolveAvatarUrl(profile.data.avatarUrl)}
            alt={profile.data.displayName ?? profile.data.username}
            fallback={profile.data.displayName ?? profile.data.username}
            size="lg"
            className="size-24 text-2xl"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-semibold sm:text-3xl">
                {profile.data.displayName ?? profile.data.username}
              </h1>
              {profile.data.isPioneer ? <Badge tone="primary">Pionnier</Badge> : null}
              <Badge tone="success">Profil public</Badge>
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              @{profile.data.username}
            </p>
            {profile.data.bio ? (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6">
                {profile.data.bio}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Membre depuis le{' '}
              {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(
                new Date(profile.data.createdAt),
              )}
            </p>
          </div>
        </div>
      </Panel>
      <section>
        <SectionHeader title="Statistiques publiques" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Amis" value={stats.friendsCount} />
          {stats.cardsCount !== undefined ? (
            <StatCard label="Cartes possédées" value={stats.cardsCount} />
          ) : null}
          {stats.uniqueCardsCount !== undefined ? (
            <StatCard label="Cartes uniques" value={stats.uniqueCardsCount} />
          ) : null}
          {stats.decksCount !== undefined ? (
            <StatCard label="Decks" value={stats.decksCount} />
          ) : null}
          {stats.matchCount !== undefined ? (
            <StatCard label="Parties" value={stats.matchCount} />
          ) : null}
          {stats.wins !== undefined ? <StatCard label="Victoires" value={stats.wins} /> : null}
          {stats.currentRank !== undefined ? (
            <StatCard
              label="Rang actuel"
              value={stats.currentRank ? `#${stats.currentRank}` : 'Non classé'}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

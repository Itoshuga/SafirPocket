'use client';

import type { ProfileSummary, UserPreferences, UserProfile } from '@safir/shared-types';
import { Button, ErrorState, SectionHeader, Skeleton, StatCard } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { ProfileHeader } from './profile-header';

export function ProfileOverview() {
  const notify = useAppStore((state) => state.notify);
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<UserProfile>('/api/v1/me/profile'),
  });
  const preferences = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => apiFetch<UserPreferences>('/api/v1/me/preferences'),
  });
  const summary = useQuery({
    queryKey: queryKeys.profileSummary,
    queryFn: () => apiFetch<ProfileSummary>('/api/v1/me/profile/stats'),
  });
  if (profile.isLoading || preferences.isLoading) return <Skeleton className="h-[38rem]" />;
  if (profile.isError || preferences.isError || !profile.data || !preferences.data) {
    return <ErrorState message="Impossible de charger le profil." />;
  }
  if (profile.data.isDeactivated) {
    return (
      <ErrorState
        title="Compte désactivé"
        message="Votre profil public est masqué tant que le compte n'est pas réactivé."
        action={
          <Button asChild size="sm">
            <Link href="/settings/account">
              <ShieldAlert className="size-4" /> Gérer le compte
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-8">
      <ProfileHeader
        profile={profile.data}
        visibility={preferences.data.profileVisibility}
        onCopy={() => {
          const url = `${window.location.origin}/users/${encodeURIComponent(profile.data.username)}`;
          void navigator.clipboard.writeText(url).then(() => {
            notify('Lien du profil copié.', 'success');
          });
        }}
      />
      <section aria-labelledby="profile-statistics-title">
        <SectionHeader title="Statistiques" description="Données confirmées par le serveur." />
        {summary.isError ? (
          <ErrorState message="Les statistiques ne sont pas disponibles." />
        ) : null}
        {summary.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        ) : null}
        {summary.data ? (
          <div id="profile-statistics-title" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Cartes possédées" value={summary.data.collection.totalCopies} />
            <StatCard label="Cartes uniques" value={summary.data.collection.uniqueCards} />
            <StatCard label="Decks" value={summary.data.deckCount} />
            <StatCard label="Amis" value={summary.data.friendsCount ?? 0} />
            <StatCard label="Parties" value={summary.data.matchCount} />
            <StatCard label="Victoires" value={summary.data.wins} />
            <StatCard
              label="Rang actuel"
              value={summary.data.currentRank ? `#${summary.data.currentRank}` : 'Non classé'}
              hint={summary.data.currentRating ? `${summary.data.currentRating} points` : undefined}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

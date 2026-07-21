'use client';

import type { ProfileStats, UserPreferences, UserProfile } from '@safir/shared-types';
import { Button, ErrorState, Skeleton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { Copy, Settings, ShieldAlert, UserPen } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { CollectionView } from './collection-view';
import { ProfileHeader } from './profile-header';
import { ProfileStatsBar } from './profile-stats-bar';

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
  const stats = useQuery({
    queryKey: queryKeys.profileStats,
    queryFn: () => apiFetch<ProfileStats>('/api/v1/me/profile/stats'),
  });

  if (profile.data?.isDeactivated) {
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
    <div className="space-y-7">
      {profile.isLoading || preferences.isLoading ? <Skeleton className="h-52 w-full" /> : null}
      {profile.isError || preferences.isError ? (
        <ErrorState message="Impossible de charger les informations du profil." />
      ) : null}
      {profile.data && preferences.data ? (
        <ProfileHeader
          profile={profile.data}
          visibility={preferences.data.profileVisibility}
          actions={
            <>
              <Button asChild size="sm">
                <Link href="/settings/profile">
                  <UserPen className="size-4" /> Modifier le profil
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/settings/profile">
                  <Settings className="size-4" /> Préférences
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/users/${encodeURIComponent(profile.data.username)}`;
                  void navigator.clipboard.writeText(url).then(() => {
                    notify('Lien du profil copié.', 'success');
                  });
                }}
              >
                <Copy className="size-4" /> Copier le lien
              </Button>
            </>
          }
        />
      ) : null}
      {stats.isError ? (
        <ErrorState message="Les statistiques du profil ne sont pas disponibles." />
      ) : (
        <ProfileStatsBar
          loading={stats.isLoading}
          items={
            stats.data
              ? [
                  { label: 'Cartes uniques', value: stats.data.uniqueCardsCount },
                  { label: 'Copies totales', value: stats.data.totalCardsCount },
                  {
                    label: 'Progression',
                    value: `${stats.data.collectionCompletionPercentage} %`,
                    hint: `${stats.data.totalAvailableCardsCount} cartes disponibles`,
                  },
                  { label: 'Decks', value: stats.data.decksCount },
                  { label: 'Amis', value: stats.data.friendsCount },
                ]
              : []
          }
        />
      )}
      <CollectionView stats={stats.data} />
    </div>
  );
}

'use client';

import type { AdminOverview as AdminOverviewData } from '@safir/shared-types';
import { EmptyState, ErrorState, Panel, Skeleton, StatCard } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { Ban, BookOpen, Gem, Layers3, ShieldAlert, Tags, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function AdminOverview() {
  const query = useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: () => apiFetch<AdminOverviewData>('/api/v1/admin/overview'),
  });
  if (query.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Vue admin indisponible"
        message="Le rôle ou l’API n’autorise pas cette vue."
      />
    );
  }
  const { counts, recentActions } = query.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Utilisateurs"
          value={counts.totalUsers}
          icon={<Users className="size-4" />}
        />
        <StatCard label="Actifs" value={counts.activeUsers} />
        <StatCard
          label="Suspendus"
          value={counts.suspendedUsers}
          icon={<ShieldAlert className="size-4" />}
        />
        <StatCard label="Bannis" value={counts.bannedUsers} icon={<Ban className="size-4" />} />
        <StatCard label="Pionniers" value={counts.pioneers} icon={<Gem className="size-4" />} />
        <StatCard label="Cartes" value={counts.cards} icon={<BookOpen className="size-4" />} />
        <StatCard label="Raretés" value={counts.rarities} />
        <StatCard label="Saisons" value={counts.seasons} icon={<Layers3 className="size-4" />} />
        <StatCard label="Types" value={counts.types} icon={<Tags className="size-4" />} />
      </div>
      <Panel>
        <h2 className="text-base font-semibold">Dernières actions</h2>
        {recentActions.length ? (
          <ul className="mt-4 divide-y divide-border">
            {recentActions.map((action) => (
              <li
                key={action.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <strong>
                    {action.actor?.displayName ?? action.actor?.username ?? 'Système'}
                  </strong>{' '}
                  · {action.action}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={action.createdAt}>
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(action.createdAt))}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState compact title="Aucune action enregistrée" />
          </div>
        )}
      </Panel>
    </div>
  );
}

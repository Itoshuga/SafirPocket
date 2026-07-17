'use client';

import type { AdminOverview as AdminOverviewData } from '@safir/shared-types';
import { Badge, ErrorState, Panel, Skeleton, StatCard } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { Activity, BookOpen, PackageOpen, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function AdminOverview() {
  const query = useQuery({
    queryKey: queryKeys.adminStatus,
    queryFn: () => apiFetch<AdminOverviewData>('/api/v1/admin/overview'),
  });
  if (query.isLoading)
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    );
  if (query.isError || !query.data)
    return (
      <ErrorState
        title="Vue admin indisponible"
        message="Le rôle ou l’API n’autorise pas cette vue."
      />
    );
  const { counts } = query.data;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Extensions publiées"
          value={counts.publishedSets}
          icon={<BookOpen className="size-4" />}
        />
        <StatCard label="Cartes publiées" value={counts.publishedCards} />
        <StatCard
          label="Boosters publiés"
          value={counts.publishedBoosters}
          icon={<PackageOpen className="size-4" />}
        />
        <StatCard
          label="Matchs actifs"
          value={counts.activeMatches}
          icon={<Activity className="size-4" />}
        />
        <StatCard label="Profils" value={counts.profiles} icon={<Users className="size-4" />} />
      </div>
      <Panel className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">État de la fondation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Les compteurs ci-dessus proviennent directement de la base. Les opérations d’écriture
              admin ne sont pas encore exposées.
            </p>
          </div>
          <Badge tone="success">API prête</Badge>
        </div>
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Dernière lecture :{' '}
          {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(query.data.generatedAt),
          )}
        </p>
      </Panel>
    </div>
  );
}

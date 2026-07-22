'use client';

import type { PackOpening, PaginatedResponse } from '@safir/shared-types';
import { Badge, Button, EmptyState, ErrorState, Pagination, Skeleton } from '@safir/ui';
import { Eye, PackageOpen, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { BoosterArtwork } from './booster-artwork';

export function BoosterOpeningHistory() {
  const [page, setPage] = useState(1);
  const filters = `page=${page}&pageSize=12`;
  const history = useQuery({
    queryKey: queryKeys.boosterOpenings(filters),
    queryFn: () => apiFetch<PaginatedResponse<PackOpening>>(`/api/v1/me/pack-openings?${filters}`),
  });

  if (history.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    );
  }
  if (history.isError) {
    return (
      <ErrorState
        message="Impossible de charger l'historique des ouvertures."
        action={
          <Button size="sm" variant="outline" onClick={() => void history.refetch()}>
            Réessayer
          </Button>
        }
      />
    );
  }
  if (!history.data?.data.length) {
    return (
      <EmptyState
        icon={<PackageOpen className="size-5" aria-hidden="true" />}
        title="Aucune ouverture enregistrée"
        description="Vos prochains boosters ouverts apparaîtront ici."
        action={
          <Button asChild>
            <Link href="/boosters">Voir les boosters</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <ol className="divide-y divide-border border-y border-border bg-surface">
        {history.data.data.map((opening) => (
          <li
            key={opening.id}
            className="grid gap-4 py-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
          >
            <BoosterArtwork
              imageUrl={opening.booster.imageUrl}
              name={opening.booster.name}
              className="h-20 w-20 rounded-md border border-border"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold">{opening.booster.name}</h2>
                <Badge tone="success">Terminée</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {opening.booster.season.name} · 8 cartes ·{' '}
                {new Intl.DateTimeFormat('fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(opening.openedAt))}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button asChild size="sm" variant="outline">
                <Link href={`/boosters/open/${encodeURIComponent(opening.id)}?replay=1`}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Rejouer
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/boosters/open/${encodeURIComponent(opening.id)}?recap=1`}>
                  <Eye className="size-4" aria-hidden="true" />
                  Récapitulatif
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Pagination
        page={history.data.pagination.page}
        pageCount={history.data.pagination.pageCount}
        onPageChange={setPage}
      />
    </div>
  );
}

'use client';

import type { RankingEntry, RankingsResponse } from '@safir/shared-types';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  MobileList,
  Pagination,
  SearchInput,
  Skeleton,
  StatCard,
  Table,
  cn,
} from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';

export function RankingsView() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const deferred = useDeferredValue(search);
  const page = Number(params.get('page') ?? '1');
  const update = (values: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  useEffect(() => {
    if (deferred === (params.get('search') ?? '')) return;
    update({ search: deferred || null, page: 1 });
    // Only the deferred input should synchronize the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred]);
  const queryString = new URLSearchParams({
    page: String(page),
    pageSize: '25',
    ...(deferred ? { search: deferred } : {}),
  }).toString();
  const rankings = useQuery({
    queryKey: queryKeys.rankings(queryString),
    queryFn: () => apiFetch<RankingsResponse>(`/api/v1/rankings?${queryString}`),
  });
  const mine = useQuery({
    queryKey: queryKeys.myRanking,
    queryFn: () =>
      apiFetch<{ season: RankingsResponse['season']; entry: RankingEntry | null }>(
        '/api/v1/me/ranking',
      ),
    enabled: Boolean(user),
  });
  if (rankings.isLoading)
    return (
      <div>
        <Skeleton className="h-20" />
        <Skeleton className="mt-5 h-96" />
      </div>
    );
  if (rankings.isError)
    return (
      <ErrorState
        message="Le classement est momentanément indisponible."
        action={
          <Button variant="outline" onClick={() => void rankings.refetch()}>
            Réessayer
          </Button>
        }
      />
    );
  if (!rankings.data?.season)
    return (
      <EmptyState
        icon={<Trophy className="size-5" />}
        title="Aucune saison classée"
        description="Le serveur ne contient encore aucune saison active ou passée."
      />
    );
  const row = (entry: RankingEntry, mobile = false) => (
    <div
      className={cn(
        'flex items-center gap-3',
        mobile && 'p-4',
        entry.user.id === user?.id && 'bg-primary-soft',
      )}
    >
      <span className="w-8 shrink-0 text-center text-sm font-semibold">#{entry.rank}</span>
      <Avatar
        alt={entry.user.displayName ?? entry.user.username}
        fallback={entry.user.displayName ?? entry.user.username}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {entry.user.displayName ?? entry.user.username}
        </span>
        <span className="block text-xs text-muted-foreground">
          {entry.wins} V · {entry.losses} D · {entry.draws} N
        </span>
      </span>
      <span className="text-sm font-semibold">{entry.rating}</span>
    </div>
  );
  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_14rem]">
        {' '}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="primary">{rankings.data.season.name}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                Du{' '}
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                  new Date(rankings.data.season.startsAt),
                )}{' '}
                au{' '}
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                  new Date(rankings.data.season.endsAt),
                )}
              </p>
            </div>
            <p className="text-sm font-semibold">
              {rankings.data.pagination.total} joueur{rankings.data.pagination.total > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {user ? (
          <StatCard
            label="Ma position"
            value={mine.data?.entry ? `#${mine.data.entry.rank}` : 'Non classé'}
            hint={mine.data?.entry ? `${mine.data.entry.rating} points` : 'Aucune partie classée'}
          />
        ) : null}
      </div>
      <SearchInput
        className="mb-4 max-w-md"
        aria-label="Rechercher un joueur"
        placeholder="Rechercher un joueur…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onClear={() => setSearch('')}
      />
      {!rankings.data.data.length ? (
        <EmptyState title="Aucun joueur trouvé" description="Modifiez le nom recherché." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table caption="Classement des joueurs">
              <thead className="bg-surface-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Rang</th>
                  <th className="px-4 py-3 font-medium">Joueur</th>
                  <th className="px-4 py-3 text-right font-medium">Victoires</th>
                  <th className="px-4 py-3 text-right font-medium">Défaites</th>
                  <th className="px-4 py-3 text-right font-medium">Nuls</th>
                  <th className="px-4 py-3 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {rankings.data.data.map((entry) => (
                  <tr
                    key={entry.user.id}
                    className={cn(entry.user.id === user?.id && 'bg-primary-soft')}
                  >
                    <td className="px-4 py-3 font-semibold">#{entry.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          alt={entry.user.displayName ?? entry.user.username}
                          fallback={entry.user.displayName ?? entry.user.username}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium">
                            {entry.user.displayName ?? entry.user.username}
                          </p>
                          <p className="text-xs text-muted-foreground">@{entry.user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{entry.wins}</td>
                    <td className="px-4 py-3 text-right">{entry.losses}</td>
                    <td className="px-4 py-3 text-right">{entry.draws}</td>
                    <td className="px-4 py-3 text-right font-semibold">{entry.rating}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList>
            {rankings.data.data.map((entry) => (
              <div key={entry.user.id}>{row(entry, true)}</div>
            ))}
          </MobileList>
          <Pagination
            page={rankings.data.pagination.page}
            pageCount={rankings.data.pagination.pageCount}
            onPageChange={(nextPage) => update({ page: nextPage })}
          />
        </>
      )}
    </div>
  );
}

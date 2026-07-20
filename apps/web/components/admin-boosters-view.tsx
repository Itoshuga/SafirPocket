'use client';

import {
  hasPermission,
  type AdminBoosterDetails,
  type CardSeason,
  type PaginatedResponse,
} from '@safir/shared-types';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  MobileList,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  Table,
} from '@safir/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, Pause, Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from './auth-provider';
import { BoosterArtwork } from './booster-artwork';

type Action = 'duplicate' | 'activate' | 'deactivate' | 'archive' | 'restore' | 'delete';

export function AdminBoostersView() {
  const { role } = useAuth();
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [seasonId, setSeasonId] = useState('');
  const [archived, setArchived] = useState('active');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ booster: AdminBoosterDetails; action: Action } | null>(
    null,
  );
  const params = new URLSearchParams({ page: String(page), pageSize: '25', archived });
  if (deferredSearch) params.set('search', deferredSearch);
  if (seasonId) params.set('seasonId', seasonId);
  const filters = params.toString();
  const boosters = useQuery({
    queryKey: queryKeys.adminBoosters(filters),
    queryFn: () =>
      apiFetch<PaginatedResponse<AdminBoosterDetails>>(`/api/v1/admin/boosters?${filters}`),
  });
  const seasons = useQuery({
    queryKey: queryKeys.adminSeasons('all'),
    queryFn: () => apiFetch<CardSeason[]>('/api/v1/admin/seasons?archived=all'),
  });
  const action = useMutation({
    mutationFn: ({ booster, action }: { booster: AdminBoosterDetails; action: Action }) => {
      const suffix = action === 'archive' ? '' : action === 'delete' ? '/permanent' : `/${action}`;
      return apiFetch(`/api/v1/admin/boosters/${booster.id}${suffix}`, {
        method: action === 'archive' || action === 'delete' ? 'DELETE' : 'POST',
      });
    },
    onSuccess: async (_, variables) => {
      notify(
        variables.action === 'duplicate'
          ? 'Une copie inactive du booster a été créée.'
          : 'Le booster a été mis à jour et l’action a été journalisée.',
        'success',
      );
      setPending(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'boosters'] }),
        client.invalidateQueries({ queryKey: queryKeys.boosterProducts }),
        client.invalidateQueries({ queryKey: queryKeys.adminOverview }),
      ]);
    },
    onError: (error) => notify(error.message, 'error'),
  });
  const rows = boosters.data?.data ?? [];
  const run = (booster: AdminBoosterDetails, actionName: Action) => {
    if (actionName === 'archive' || actionName === 'delete') {
      setPending({ booster, action: actionName });
    } else {
      action.mutate({ booster, action: actionName });
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          onClear={() => setSearch('')}
          placeholder="Rechercher un booster"
          aria-label="Rechercher un booster"
          className="sm:w-80"
        />
        <Button asChild>
          <Link href="/admin/boosters/new">
            <Plus className="size-4" />
            Ajouter un booster
          </Link>
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Select
          value={seasonId}
          onChange={(event) => {
            setSeasonId(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par saison"
        >
          <option value="">Toutes les saisons</option>
          {seasons.data?.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </Select>
        <Select
          value={archived}
          onChange={(event) => {
            setArchived(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par archivage"
        >
          <option value="active">Actifs et inactifs</option>
          <option value="archived">Archivés</option>
          <option value="all">Tous</option>
        </Select>
      </div>
      {boosters.isLoading ? <Skeleton className="mt-5 h-96" /> : null}
      {boosters.isError ? (
        <div className="mt-5">
          <ErrorState message="Impossible de charger les boosters." />
        </div>
      ) : null}
      {!boosters.isLoading && rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="Aucun booster"
            description="Modifiez les filtres ou créez un design."
          />
        </div>
      ) : null}
      {rows.length ? (
        <>
          <div className="mt-5 hidden xl:block">
            <Table caption="Boosters administratifs">
              <thead className="bg-surface-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Booster</th>
                  <th className="px-4 py-3">Saison</th>
                  <th className="px-4 py-3">Contenu</th>
                  <th className="px-4 py-3">Taux</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {rows.map((booster) => (
                  <tr key={booster.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <BoosterArtwork
                          imageUrl={booster.imageUrl}
                          name={booster.name}
                          className="h-14 w-11 shrink-0 rounded-sm border border-border"
                        />
                        <div>
                          <p className="font-medium">{booster.name}</p>
                          <p className="text-xs text-muted-foreground">{booster.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{booster.season.name}</td>
                    <td className="px-4 py-3 text-sm">
                      6 × {booster.guaranteedCommonRarity.name}
                      <br />2 × premium
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {booster.dropRates
                        .map((rate) => `${rate.rarity.name} ${rate.dropRateBps / 100} %`)
                        .join(' · ')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {booster.cost.amount === 0
                        ? 'Gratuit'
                        : `${booster.cost.amount} ${booster.cost.currencyCode}`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          booster.deletedAt ? 'warning' : booster.isActive ? 'success' : 'neutral'
                        }
                      >
                        {booster.deletedAt ? 'Archivé' : booster.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <BoosterActions
                        booster={booster}
                        role={role}
                        run={run}
                        loading={action.isPending}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList className="mt-5 xl:hidden">
            {rows.map((booster) => (
              <div key={booster.id} className="p-4">
                <div className="flex items-center gap-3">
                  <BoosterArtwork
                    imageUrl={booster.imageUrl}
                    name={booster.name}
                    className="h-16 w-12 shrink-0 rounded-sm border border-border"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{booster.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {booster.season.name} · {booster.dropRates.length} taux
                    </p>
                  </div>
                  <Badge
                    tone={booster.deletedAt ? 'warning' : booster.isActive ? 'success' : 'neutral'}
                  >
                    {booster.deletedAt ? 'Archivé' : booster.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
                <BoosterActions
                  booster={booster}
                  role={role}
                  run={run}
                  loading={action.isPending}
                  className="mt-3"
                />
              </div>
            ))}
          </MobileList>
          <Pagination
            page={boosters.data?.pagination.page ?? 1}
            pageCount={boosters.data?.pagination.pageCount ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.action === 'delete'
            ? 'Supprimer définitivement le booster'
            : 'Archiver le booster'
        }
        description={pending ? `Confirmer l’action sur « ${pending.booster.name} ».` : ''}
        confirmLabel="Confirmer"
        danger={pending?.action === 'delete'}
        loading={action.isPending}
        onConfirm={() => {
          if (pending) action.mutate(pending);
        }}
      />
    </div>
  );
}

function BoosterActions({
  booster,
  role,
  run,
  loading,
  className,
}: {
  booster: AdminBoosterDetails;
  role: 'USER' | 'PIONEER' | 'MODERATOR' | 'ADMINISTRATOR';
  run: (booster: AdminBoosterDetails, action: Action) => void;
  loading: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap justify-end gap-1 ${className ?? ''}`}>
      <Button asChild size="icon" variant="ghost">
        <Link
          href={`/admin/boosters/${booster.id}`}
          aria-label={`Modifier ${booster.name}`}
          title="Modifier"
        >
          <Pencil className="size-4" />
        </Link>
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={loading}
        onClick={() => run(booster, 'duplicate')}
        aria-label={`Dupliquer ${booster.name}`}
        title="Dupliquer"
      >
        <Copy className="size-4" />
      </Button>
      {!booster.deletedAt ? (
        <Button
          size="icon"
          variant="ghost"
          disabled={loading || (booster.isActive && !booster.validation.valid)}
          onClick={() => run(booster, booster.isActive ? 'deactivate' : 'activate')}
          aria-label={booster.isActive ? `Désactiver ${booster.name}` : `Activer ${booster.name}`}
          title={booster.isActive ? 'Désactiver' : 'Activer'}
        >
          {booster.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
      ) : null}
      {!booster.deletedAt ? (
        <Button
          size="icon"
          variant="ghost"
          disabled={loading}
          onClick={() => run(booster, 'archive')}
          aria-label={`Archiver ${booster.name}`}
          title="Archiver"
        >
          <Archive className="size-4" />
        </Button>
      ) : hasPermission(role, 'BOOSTERS_RESTORE') ? (
        <Button
          size="icon"
          variant="ghost"
          disabled={loading}
          onClick={() => run(booster, 'restore')}
          aria-label={`Restaurer ${booster.name}`}
          title="Restaurer"
        >
          <RotateCcw className="size-4" />
        </Button>
      ) : null}
      {booster.deletedAt && hasPermission(role, 'BOOSTERS_DELETE_PERMANENTLY') ? (
        <Button
          size="icon"
          variant="ghost"
          disabled={loading || booster.openingCount > 0}
          onClick={() => run(booster, 'delete')}
          aria-label={`Supprimer définitivement ${booster.name}`}
          title="Supprimer définitivement"
        >
          <Trash2 className="size-4 text-danger" />
        </Button>
      ) : null}
    </div>
  );
}

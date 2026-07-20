'use client';

import {
  hasPermission,
  type AdminCard,
  type CardExportFilters,
  type CardFacets,
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
import { Archive, Download, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from './auth-provider';
import { AdminCardExportDialog } from './admin-card-export-dialog';
import { AdminCardImportDialog } from './admin-card-import-dialog';
import { CardImage } from './card-image';

type CardAction = 'archive' | 'restore' | 'delete';

export function AdminCardsView() {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [seasonId, setSeasonId] = useState('');
  const [rarityId, setRarityId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [commander, setCommander] = useState('all');
  const [status, setStatus] = useState('all');
  const [archived, setArchived] = useState('active');
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ card: AdminCard; action: CardAction } | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: '25', archived });
  if (deferredSearch) params.set('search', deferredSearch);
  if (seasonId) params.set('seasonId', seasonId);
  if (rarityId) params.set('rarityId', rarityId);
  if (typeId) params.set('typeId', typeId);
  if (commander !== 'all') params.set('isCommander', commander);
  if (status !== 'all') params.set('status', status);
  const filters = params.toString();
  const exportFilters: CardExportFilters = {
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(seasonId ? { seasonId } : {}),
    ...(rarityId ? { rarityId } : {}),
    ...(typeId ? { typeId } : {}),
    ...(commander !== 'all' ? { isCommander: commander === 'true' } : {}),
    status: status as CardExportFilters['status'],
    archived: archived as CardExportFilters['archived'],
  };
  const canImport = hasPermission(role, 'CARDS_IMPORT');
  const canExport = hasPermission(role, 'CARDS_EXPORT');
  const canCreate = hasPermission(role, 'CARDS_CREATE');
  const cards = useQuery({
    queryKey: queryKeys.adminCards(filters),
    queryFn: () => apiFetch<PaginatedResponse<AdminCard>>(`/api/v1/admin/cards?${filters}`),
  });
  const facets = useQuery({
    queryKey: queryKeys.cardFacets,
    queryFn: () => apiFetch<CardFacets>('/api/v1/card-facets'),
  });
  const mutate = useMutation({
    mutationFn: ({ card, action }: NonNullable<typeof pending>) =>
      apiFetch(
        `/api/v1/admin/cards/${card.id}${action === 'restore' ? '/restore' : action === 'delete' ? '/permanent' : ''}`,
        {
          method: action === 'restore' ? 'POST' : 'DELETE',
        },
      ),
    onSuccess: async () => {
      notify('Carte mise à jour et action journalisée.', 'success');
      setPending(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.adminCardsRoot }),
        client.invalidateQueries({ queryKey: queryKeys.adminOverview }),
        client.invalidateQueries({ queryKey: queryKeys.cards('') }),
      ]);
    },
    onError: (error) => notify(error.message, 'error'),
  });
  const rows = cards.data?.data ?? [];
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
          placeholder="Rechercher une carte"
          aria-label="Rechercher une carte"
          className="sm:w-80"
        />
        <div className="flex flex-wrap gap-2">
          {canImport ? (
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Importer
            </Button>
          ) : null}
          {canExport ? (
            <Button variant="secondary" onClick={() => setExportOpen(true)}>
              <Download className="size-4" />
              Exporter
            </Button>
          ) : null}
          {canCreate ? (
            <Button asChild>
              <Link href="/admin/cards/new">
                <Plus className="size-4" />
                Ajouter une carte
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Select
          value={seasonId}
          onChange={(event) => {
            setSeasonId(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par saison"
        >
          <option value="">Toutes les saisons</option>
          {facets.data?.seasons.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          value={commander}
          onChange={(event) => {
            setCommander(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par commandant"
        >
          <option value="all">Toutes les cartes</option>
          <option value="true">Commandants</option>
          <option value="false">Non-commandants</option>
        </Select>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
        </Select>
        <Select
          value={rarityId}
          onChange={(event) => {
            setRarityId(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par rareté"
        >
          <option value="">Toutes les raretés</option>
          {facets.data?.rarities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          value={typeId}
          onChange={(event) => {
            setTypeId(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par type"
        >
          <option value="">Tous les types</option>
          {facets.data?.types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
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
          <option value="active">Actives</option>
          <option value="archived">Archivées</option>
          <option value="all">Toutes</option>
        </Select>
      </div>
      {cards.isLoading ? <Skeleton className="mt-5 h-96" /> : null}
      {cards.isError ? (
        <div className="mt-5">
          <ErrorState message="Impossible de charger les cartes." />
        </div>
      ) : null}
      {!cards.isLoading && rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="Aucune carte" description="Modifiez les filtres ou créez une carte." />
        </div>
      ) : null}
      {rows.length ? (
        <>
          <div className="mt-5 hidden lg:block">
            <Table caption="Cartes administratives">
              <thead className="bg-surface-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Carte</th>
                  <th className="px-4 py-3">Combat</th>
                  <th className="px-4 py-3">Rareté</th>
                  <th className="px-4 py-3">Saison</th>
                  <th className="px-4 py-3">Types</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {rows.map((card) => (
                  <tr key={card.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CardImage
                          artworkPath={card.imageUrl ?? card.artworkPath}
                          alt={card.name}
                          className="w-11 shrink-0"
                        />
                        <div>
                          <p className="font-medium">{card.name}</p>
                          <p className="text-xs text-muted-foreground">
                            #{card.number}
                            {card.isCommander ? ' · Commandant' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {card.attack} / {card.defense} · {card.value}
                    </td>
                    <td className="px-4 py-3">{card.rarity.name}</td>
                    <td className="px-4 py-3">{card.season.name}</td>
                    <td className="px-4 py-3 text-sm">
                      {card.types.map((type) => type.name).join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={card.deletedAt ? 'warning' : card.isActive ? 'success' : 'neutral'}
                      >
                        {card.deletedAt ? 'Archivée' : card.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="ghost">
                          <Link
                            href={`/admin/cards/${card.id}`}
                            aria-label={`Modifier ${card.name}`}
                            title="Modifier"
                          >
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        {card.deletedAt ? (
                          role === 'ADMINISTRATOR' ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Restaurer ${card.name}`}
                              title="Restaurer"
                              onClick={() => setPending({ card, action: 'restore' })}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : null
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Archiver ${card.name}`}
                            title="Archiver"
                            onClick={() => setPending({ card, action: 'archive' })}
                          >
                            <Archive className="size-4" />
                          </Button>
                        )}
                        {card.deletedAt && role === 'ADMINISTRATOR' ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Supprimer définitivement ${card.name}`}
                            title="Supprimer définitivement"
                            onClick={() => setPending({ card, action: 'delete' })}
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList className="mt-5 lg:hidden">
            {rows.map((card) => (
              <Link
                key={card.id}
                href={`/admin/cards/${card.id}`}
                className="flex items-center gap-3 p-4"
              >
                <CardImage
                  artworkPath={card.imageUrl ?? card.artworkPath}
                  alt={card.name}
                  className="w-12 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{card.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    #{card.number} · {card.rarity.name} · {card.season.name}
                  </span>
                </span>
                <Badge tone={card.deletedAt ? 'warning' : 'success'}>
                  {card.deletedAt ? 'Archivée' : 'Active'}
                </Badge>
              </Link>
            ))}
          </MobileList>
          <Pagination
            page={cards.data?.pagination.page ?? 1}
            pageCount={cards.data?.pagination.pageCount ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending?.action === 'delete'
            ? 'Supprimer définitivement la carte'
            : pending?.action === 'restore'
              ? 'Restaurer la carte'
              : 'Archiver la carte'
        }
        description={pending ? `Confirmer l’action sur « ${pending.card.name} ».` : ''}
        confirmLabel="Confirmer"
        danger={pending?.action === 'delete'}
        loading={mutate.isPending}
        onConfirm={() => {
          if (pending) mutate.mutate(pending);
        }}
      />
      {canImport ? (
        <AdminCardImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          canCreateRelations={hasPermission(role, 'CARDS_IMPORT_CREATE_RELATIONS')}
          onImported={async () => {
            await Promise.all([
              client.invalidateQueries({ queryKey: queryKeys.adminCardsRoot }),
              client.invalidateQueries({ queryKey: queryKeys.adminOverview }),
              client.invalidateQueries({ queryKey: queryKeys.cards('') }),
              client.invalidateQueries({ queryKey: queryKeys.cardFacets }),
              client.invalidateQueries({ queryKey: queryKeys.adminRaritiesRoot }),
              client.invalidateQueries({ queryKey: queryKeys.adminSeasonsRoot }),
              client.invalidateQueries({ queryKey: queryKeys.adminCardTypesRoot }),
            ]);
          }}
        />
      ) : null}
      {canExport ? (
        <AdminCardExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          filters={exportFilters}
        />
      ) : null}
    </div>
  );
}

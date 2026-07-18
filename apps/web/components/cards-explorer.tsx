'use client';

import type { CardFacets, CardSummary, PaginatedResponse } from '@safir/shared-types';
import {
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  Panel,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  Tag,
} from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { TcgCard } from './tcg-card';

export function CardsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const deferredSearch = useDeferredValue(search);
  const page = Number(searchParams.get('page') ?? '1');
  const set = searchParams.get('set') ?? '';
  const rarity = searchParams.get('rarity') ?? '';
  const type = searchParams.get('type') ?? '';
  const sort = searchParams.get('sort') ?? 'number';

  function update(values: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, String(value));
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
  }

  useEffect(() => {
    if (deferredSearch === (searchParams.get('search') ?? '')) return;
    update({ search: deferredSearch || null, page: 1 });
    // Only the deferred input should trigger this URL synchronization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch]);

  const apiParams = new URLSearchParams({ page: String(page), pageSize: '36', sort });
  if (deferredSearch) apiParams.set('search', deferredSearch);
  if (set) apiParams.set('set', set);
  if (rarity) apiParams.set('rarity', rarity);
  if (type) apiParams.set('type', type);
  const queryString = apiParams.toString();
  const cards = useQuery({
    queryKey: queryKeys.cards(queryString),
    queryFn: () => apiFetch<PaginatedResponse<CardSummary>>(`/api/v1/cards?${queryString}`),
  });
  const facets = useQuery({
    queryKey: queryKeys.cardFacets,
    queryFn: () => apiFetch<CardFacets>('/api/v1/card-facets'),
  });
  const activeFilters = [
    set
      ? { key: 'set', label: facets.data?.seasons.find((item) => item.slug === set)?.name ?? set }
      : null,
    rarity
      ? {
          key: 'rarity',
          label: facets.data?.rarities.find((item) => item.slug === rarity)?.name ?? rarity,
        }
      : null,
    type
      ? { key: 'type', label: facets.data?.types.find((item) => item.slug === type)?.name ?? type }
      : null,
  ].filter((item): item is { key: string; label: string } => Boolean(item));

  const controls = (
    <div className="grid gap-4">
      <label className="text-sm font-medium">
        Saison
        <Select
          className="mt-1.5"
          value={set}
          onChange={(event) => update({ set: event.target.value || null, page: 1 })}
        >
          <option value="">Toutes les saisons</option>
          {facets.data?.seasons.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name} ({item.cardCount ?? 0})
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Rareté
        <Select
          className="mt-1.5"
          value={rarity}
          onChange={(event) => update({ rarity: event.target.value || null, page: 1 })}
        >
          <option value="">Toutes les raretés</option>
          {facets.data?.rarities.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Type
        <Select
          className="mt-1.5"
          value={type}
          onChange={(event) => update({ type: event.target.value || null, page: 1 })}
        >
          <option value="">Tous les types</option>
          {facets.data?.types.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <Button
        variant="ghost"
        onClick={() => {
          setSearch('');
          update({ search: null, set: null, rarity: null, type: null, page: 1 });
        }}
      >
        <X className="size-4" /> Réinitialiser
      </Button>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <Panel className="hidden h-fit p-4 lg:block">
        <h2 className="mb-4 text-sm font-semibold">Filtres</h2>
        {controls}
      </Panel>
      <div className="min-w-0">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <SearchInput
            id="card-search"
            aria-label="Rechercher des cartes"
            placeholder="Nom ou texte d’effet…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch('')}
            className="sm:max-w-md"
          />
          <div className="flex gap-2 sm:ml-auto">
            <Drawer
              title="Filtrer les cartes"
              trigger={
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal className="size-4" /> Filtres
                  {activeFilters.length ? ` (${activeFilters.length})` : ''}
                </Button>
              }
            >
              {controls}
            </Drawer>
            <Select
              aria-label="Trier les cartes"
              value={sort}
              onChange={(event) => update({ sort: event.target.value, page: 1 })}
              className="w-auto min-w-40"
            >
              <option value="number">Numéro</option>
              <option value="name">Nom A–Z</option>
              <option value="-name">Nom Z–A</option>
              <option value="-createdAt">Plus récentes</option>
            </Select>
          </div>
        </div>
        {activeFilters.length ? (
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Filtres actifs">
            {activeFilters.map((filter) => (
              <Tag
                key={filter.key}
                removable
                onRemove={() => update({ [filter.key]: null, page: 1 })}
              >
                {filter.label}
              </Tag>
            ))}
          </div>
        ) : null}
        {cards.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="aspect-[5/8]" />
            ))}
          </div>
        ) : null}
        {cards.isError ? (
          <ErrorState
            message="Le catalogue est momentanément indisponible. Vérifiez que l’API est démarrée."
            action={
              <Button variant="outline" size="sm" onClick={() => void cards.refetch()}>
                Réessayer
              </Button>
            }
          />
        ) : null}
        {cards.data && !cards.data.data.length ? (
          <EmptyState
            title="Aucune carte trouvée"
            description="Modifiez la recherche ou retirez certains filtres."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  update({ search: null, set: null, rarity: null, type: null, page: 1 });
                }}
              >
                Effacer les filtres
              </Button>
            }
          />
        ) : null}
        {cards.data?.data.length ? (
          <>
            <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
              {cards.data.pagination.total} carte{cards.data.pagination.total > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {cards.data.data.map((card) => (
                <TcgCard key={card.id} card={card} />
              ))}
            </div>
            <Pagination
              page={cards.data.pagination.page}
              pageCount={cards.data.pagination.pageCount}
              onPageChange={(nextPage) => update({ page: nextPage })}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

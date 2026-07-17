'use client';

import type {
  CardFacets,
  CollectionEntry,
  CollectionSummary,
  PaginatedResponse,
} from '@safir/shared-types';
import {
  Button,
  EmptyState,
  ErrorState,
  Panel,
  Pagination,
  Progress,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  cn,
} from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { Grid3X3, List, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { TcgCard } from './tcg-card';

export function CollectionView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const deferredSearch = useDeferredValue(search);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const page = Number(params.get('page') ?? '1');
  const set = params.get('set') ?? '';
  const rarity = params.get('rarity') ?? '';
  const sort = params.get('sort') ?? 'recent';
  function update(values: Record<string, string | number | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }
  useEffect(() => {
    if (deferredSearch === (params.get('search') ?? '')) return;
    update({ search: deferredSearch || null, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch]);
  const apiParams = new URLSearchParams({ page: String(page), pageSize: '30', sort });
  if (deferredSearch) apiParams.set('search', deferredSearch);
  if (set) apiParams.set('set', set);
  if (rarity) apiParams.set('rarity', rarity);
  const queryString = apiParams.toString();
  const collection = useQuery({
    queryKey: queryKeys.collection(queryString),
    queryFn: () =>
      apiFetch<PaginatedResponse<CollectionEntry>>(`/api/v1/me/collection?${queryString}`),
  });
  const summary = useQuery({
    queryKey: queryKeys.collectionSummary,
    queryFn: () => apiFetch<CollectionSummary>('/api/v1/me/collection/summary'),
  });
  const facets = useQuery({
    queryKey: queryKeys.cardFacets,
    queryFn: () => apiFetch<CardFacets>('/api/v1/card-facets'),
  });
  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.isLoading
          ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)
          : null}
        {summary.data ? (
          <>
            <StatCard label="Exemplaires" value={summary.data.totalCopies} />
            <StatCard
              label="Cartes uniques"
              value={summary.data.uniqueCards}
              hint={`${summary.data.completionRate} % du catalogue`}
            />
            <StatCard label="Variantes" value={summary.data.uniqueVariants} />
            <StatCard label="Rareté principale" value={summary.data.favoriteRarity ?? '—'} />
          </>
        ) : null}
      </div>
      {summary.data?.sets.length ? (
        <Panel className="mb-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Progression par extension</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cartes uniques possédées parmi les cartes actuellement publiées.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {summary.data.sets.map((setSummary) => (
              <div key={setSummary.id}>
                <Progress value={setSummary.completionRate} label={setSummary.name} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {setSummary.ownedCards}/{setSummary.cardCount} · {setSummary.missingCards}{' '}
                  manquante{setSummary.missingCards > 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      <div className="mb-5 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[minmax(14rem,1fr)_12rem_11rem_11rem_auto]">
        <SearchInput
          aria-label="Rechercher dans la collection"
          placeholder="Rechercher une carte…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
        />
        <Select
          aria-label="Filtrer par extension"
          value={set}
          onChange={(event) => update({ set: event.target.value || null, page: 1 })}
        >
          <option value="">Toutes extensions</option>
          {facets.data?.sets.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par rareté"
          value={rarity}
          onChange={(event) => update({ rarity: event.target.value || null, page: 1 })}
        >
          <option value="">Toutes raretés</option>
          {facets.data?.rarities.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
        <Select
          aria-label="Trier la collection"
          value={sort}
          onChange={(event) => update({ sort: event.target.value, page: 1 })}
        >
          <option value="recent">Obtention récente</option>
          <option value="name">Nom</option>
          <option value="-quantity">Quantité</option>
        </Select>
        <div className="flex rounded-md border border-border p-0.5">
          <Button
            size="icon"
            variant={layout === 'grid' ? 'secondary' : 'ghost'}
            onClick={() => setLayout('grid')}
            aria-label="Affichage en grille"
          >
            <Grid3X3 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={layout === 'list' ? 'secondary' : 'ghost'}
            onClick={() => setLayout('list')}
            aria-label="Affichage en liste"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
      {collection.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="aspect-[5/8]" />
          ))}
        </div>
      ) : null}
      {collection.isError ? (
        <ErrorState
          message="Impossible de charger votre collection."
          action={
            <Button variant="outline" size="sm" onClick={() => void collection.refetch()}>
              Réessayer
            </Button>
          }
        />
      ) : null}
      {collection.data && !collection.data.data.length ? (
        <EmptyState
          icon={<PackageOpen className="size-5" />}
          title={search || set || rarity ? 'Aucun résultat' : 'Votre collection est vide'}
          description={
            search || set || rarity
              ? 'Modifiez les filtres pour afficher vos cartes.'
              : 'Les cartes obtenues lors des ouvertures apparaîtront ici.'
          }
          action={
            !search && !set && !rarity ? (
              <Button asChild>
                <Link href="/boosters">Voir les boosters</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {collection.data?.data.length ? (
        <>
          {layout === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {collection.data.data.map((entry) => (
                <TcgCard
                  key={entry.cardVariantId}
                  card={{
                    ...entry.variant.card,
                    artworkPath: entry.variant.artworkPath ?? entry.variant.card.artworkPath,
                  }}
                  mode="collection"
                  variantName={entry.variant.name}
                  quantity={entry.quantity}
                  lockedQuantity={entry.lockedQuantity}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-surface">
              {collection.data.data.map((entry) => (
                <div key={entry.cardVariantId} className="flex items-center gap-2 p-1 sm:px-3">
                  <div className="min-w-0 flex-1">
                    <TcgCard
                      card={entry.variant.card}
                      mode="compact"
                      variantName={entry.variant.name}
                    />
                  </div>
                  <div className="shrink-0 pr-3 text-right">
                    <p className="text-sm font-semibold">× {entry.quantity}</p>
                    <p
                      className={cn(
                        'text-xs text-muted-foreground',
                        !entry.lockedQuantity && 'invisible',
                      )}
                    >
                      {entry.lockedQuantity} réservée{entry.lockedQuantity > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={collection.data.pagination.page}
            pageCount={collection.data.pagination.pageCount}
            onPageChange={(nextPage) => update({ page: nextPage })}
          />
        </>
      ) : null}
    </div>
  );
}

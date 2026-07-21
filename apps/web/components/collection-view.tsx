'use client';

import type {
  CardFacets,
  CollectionEntry,
  CollectionSummary,
  PaginatedResponse,
} from '@safir/shared-types';
import { Button, Panel, Progress, Skeleton, cn } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { collectionSortOptions, type CardsLayout } from '@/lib/cards-page';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { CardsGallery, CardsStats, CardsToolbar, useCardsPageFilters } from './cards-browser';
import { TcgCard } from './tcg-card';

export function CollectionView() {
  const [layout, setLayout] = useState<CardsLayout>('grid');
  const filters = useCardsPageFilters({ mode: 'COLLECTION', pageSize: 30 });
  const collection = useQuery({
    queryKey: queryKeys.collection(filters.queryString),
    queryFn: () =>
      apiFetch<PaginatedResponse<CollectionEntry>>(`/api/v1/me/collection?${filters.queryString}`),
    placeholderData: (previous) => previous,
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
      <CardsStats
        loading={summary.isLoading}
        items={[
          { label: 'Exemplaires', value: summary.data?.totalCopies ?? 0 },
          {
            label: 'Cartes uniques',
            value: summary.data?.uniqueCards ?? 0,
            hint: `${summary.data?.completionRate ?? 0} % du catalogue`,
          },
          { label: 'Variantes', value: summary.data?.uniqueVariants ?? 0 },
          { label: 'Rareté principale', value: summary.data?.favoriteRarity ?? '—' },
        ]}
      />
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
      ) : summary.isLoading ? (
        <Skeleton className="mb-6 h-32" />
      ) : null}
      <CardsToolbar
        mode="COLLECTION"
        state={filters.state}
        search={filters.search}
        facets={facets.data}
        layout={layout}
        sortOptions={collectionSortOptions}
        isFetching={collection.isFetching && !collection.isLoading}
        onSearchChange={filters.setSearch}
        onUpdate={filters.update}
        onReset={filters.reset}
        onLayoutChange={setLayout}
      />
      <CardsGallery<CollectionEntry>
        items={collection.data?.data}
        loading={collection.isLoading}
        error={collection.isError}
        errorMessage="Impossible de charger votre collection."
        layout={layout}
        page={collection.data?.pagination.page ?? filters.state.page}
        pageCount={collection.data?.pagination.pageCount ?? 0}
        total={collection.data?.pagination.total ?? 0}
        hasFilters={filters.hasFilters}
        emptyTitle="Votre collection est vide"
        emptyDescription="Les cartes obtenues lors des ouvertures apparaîtront ici."
        filteredEmptyDescription="Modifiez les filtres pour afficher vos cartes."
        emptyAction={
          <Button asChild>
            <Link href="/boosters">Voir les boosters</Link>
          </Button>
        }
        onRetry={() => void collection.refetch()}
        onReset={filters.reset}
        onPageChange={(page) => filters.update({ page })}
        getKey={(entry) => entry.cardVariantId}
        renderGridItem={(entry) => (
          <TcgCard
            card={{
              ...entry.variant.card,
              artworkPath:
                entry.variant.artworkPath ??
                entry.variant.card.imageUrl ??
                entry.variant.card.artworkPath,
            }}
            mode="collection"
            variantName={entry.variant.name}
            quantity={entry.quantity}
            lockedQuantity={entry.lockedQuantity}
          />
        )}
        renderListItem={(entry) => <CollectionCardListItem entry={entry} />}
      />
    </div>
  );
}

function CollectionCardListItem({ entry }: { entry: CollectionEntry }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <TcgCard card={entry.variant.card} mode="compact" variantName={entry.variant.name} />
      </div>
      <div className="shrink-0 pr-3 text-right">
        <p className="text-sm font-semibold">× {entry.quantity}</p>
        <p className={cn('text-xs text-muted-foreground', !entry.lockedQuantity && 'invisible')}>
          {entry.lockedQuantity} réservée{entry.lockedQuantity > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

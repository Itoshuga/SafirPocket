'use client';

import type {
  CardFacets,
  CollectionEntry,
  PaginatedResponse,
  ProfileStats,
} from '@safir/shared-types';
import { Button, cn } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api-client';
import { collectionSortOptions, type CardsLayout } from '@/lib/cards-page';
import { queryKeys } from '@/lib/query-keys';
import { CardsGallery, CardsToolbar, useCardsPageFilters } from './cards-browser';
import { TcgCard } from './tcg-card';

export function CollectionSectionIntro({
  uniqueCards,
  completion,
  description,
  action,
}: {
  uniqueCards?: number;
  completion?: number;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold text-primary">Cartes du joueur</p>
        <h2 id="collection-title" className="mt-1 text-xl font-semibold text-foreground">
          Collection
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        {uniqueCards !== undefined ? (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {uniqueCards} carte{uniqueCards > 1 ? 's' : ''} unique{uniqueCards > 1 ? 's' : ''}
            {completion !== undefined ? ` · ${completion} % du catalogue` : ''}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function CollectionView({ stats }: { stats?: ProfileStats }) {
  const [layout, setLayout] = useState<CardsLayout>('grid');
  const filters = useCardsPageFilters({ mode: 'PROFILE_COLLECTION', pageSize: 30 });
  const collection = useQuery({
    queryKey: queryKeys.collection(filters.queryString),
    queryFn: () =>
      apiFetch<PaginatedResponse<CollectionEntry>>(`/api/v1/me/collection?${filters.queryString}`),
    placeholderData: (previous) => previous,
  });
  const facets = useQuery({
    queryKey: queryKeys.cardFacets,
    queryFn: () => apiFetch<CardFacets>('/api/v1/card-facets'),
  });

  return (
    <section id="collection" aria-labelledby="collection-title" className="scroll-mt-20 pt-2">
      <CollectionSectionIntro
        uniqueCards={stats?.uniqueCardsCount}
        completion={stats?.collectionCompletionPercentage}
        description="Recherchez, filtrez et consultez tous les exemplaires confirmés par le serveur."
      />
      <CardsToolbar
        mode="PROFILE_COLLECTION"
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
    </section>
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

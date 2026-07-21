'use client';

import type {
  CardFacets,
  CollectionVisibility,
  PaginatedResponse,
  ProfileCollectionItem,
  ProfilePermissions,
  PublicProfileStats,
} from '@safir/shared-types';
import { Panel } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { collectionSortOptions, type CardsLayout } from '@/lib/cards-page';
import { queryKeys } from '@/lib/query-keys';
import { CardsGallery, CardsToolbar, useCardsPageFilters } from './cards-browser';
import { CollectionSectionIntro } from './collection-view';
import { TcgCard } from './tcg-card';

export function PublicCollectionView({
  username,
  visibility,
  permissions,
  stats,
}: {
  username: string;
  visibility: CollectionVisibility;
  permissions: ProfilePermissions;
  stats?: PublicProfileStats;
}) {
  const [layout, setLayout] = useState<CardsLayout>('grid');
  const filters = useCardsPageFilters({ mode: 'PUBLIC_PROFILE_COLLECTION', pageSize: 30 });
  const collection = useQuery({
    queryKey: queryKeys.publicProfileCollection(username, filters.queryString),
    queryFn: () =>
      apiFetch<PaginatedResponse<ProfileCollectionItem>>(
        `/api/v1/users/${encodeURIComponent(username)}/collection?${filters.queryString}`,
      ),
    enabled: permissions.canViewCollection,
    placeholderData: (previous) => previous,
  });
  const facets = useQuery({
    queryKey: queryKeys.cardFacets,
    queryFn: () => apiFetch<CardFacets>('/api/v1/card-facets'),
    enabled: permissions.canViewCollection,
  });
  const sortOptions = permissions.canViewQuantities
    ? collectionSortOptions
    : collectionSortOptions.filter(({ value }) => value !== '-quantity');

  if (!permissions.canViewCollection) {
    return (
      <section id="collection" aria-labelledby="collection-title" className="scroll-mt-20 pt-2">
        <CollectionSectionIntro description="Les préférences du joueur déterminent les cartes visibles." />
        <Panel className="py-10 text-center" role="status">
          <LockKeyhole className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {visibility === 'FRIENDS'
              ? 'Cette collection est visible uniquement par ses amis.'
              : 'La collection de cet utilisateur est privée.'}
          </p>
        </Panel>
      </section>
    );
  }

  return (
    <section id="collection" aria-labelledby="collection-title" className="scroll-mt-20 pt-2">
      <CollectionSectionIntro
        uniqueCards={stats?.uniqueCardsCount}
        completion={stats?.collectionCompletionPercentage}
        description={`Parcourez les cartes que @${username} a choisi de rendre visibles.`}
      />
      <CardsToolbar
        mode="PUBLIC_PROFILE_COLLECTION"
        state={filters.state}
        search={filters.search}
        facets={facets.data}
        layout={layout}
        sortOptions={sortOptions}
        isFetching={collection.isFetching && !collection.isLoading}
        onSearchChange={filters.setSearch}
        onUpdate={filters.update}
        onReset={filters.reset}
        onLayoutChange={setLayout}
      />
      <CardsGallery<ProfileCollectionItem>
        items={collection.data?.data}
        loading={collection.isLoading}
        error={collection.isError}
        errorMessage="Impossible de charger cette collection."
        layout={layout}
        page={collection.data?.pagination.page ?? filters.state.page}
        pageCount={collection.data?.pagination.pageCount ?? 0}
        total={collection.data?.pagination.total ?? 0}
        hasFilters={filters.hasFilters}
        emptyTitle="Aucune carte visible"
        emptyDescription="Cette collection ne contient pas encore de carte publiée."
        filteredEmptyDescription="Modifiez les filtres pour afficher d’autres cartes."
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
          />
        )}
        renderListItem={(entry) => (
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <TcgCard card={entry.variant.card} mode="compact" variantName={entry.variant.name} />
            </div>
            {entry.quantity !== undefined ? (
              <p className="shrink-0 pr-3 text-sm font-semibold">× {entry.quantity}</p>
            ) : null}
          </div>
        )}
      />
    </section>
  );
}

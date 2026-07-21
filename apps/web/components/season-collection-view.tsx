'use client';

import type {
  CardFacets,
  CollectionCardsSort,
  SeasonCollectionCardItem,
  SeasonCollectionDetails,
} from '@safir/shared-types';
import { Button, ErrorState, Progress, Skeleton, cn } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { type CardsLayout } from '@/lib/cards-page';
import { profileHref } from '@/lib/profile-routes';
import { queryKeys } from '@/lib/query-keys';
import { CardsGallery, CardsToolbar, useCardsPageFilters } from './cards-browser';
import { TcgCard } from './tcg-card';

const seasonSortOptions: ReadonlyArray<{ value: CollectionCardsSort; label: string }> = [
  { value: 'recent', label: 'Obtention récente' },
  { value: 'number', label: 'Numéro croissant' },
  { value: '-number', label: 'Numéro décroissant' },
  { value: 'name', label: 'Nom A–Z' },
  { value: '-name', label: 'Nom Z–A' },
  { value: 'rarity', label: 'Rareté' },
  { value: '-quantity', label: 'Quantité possédée' },
];

export function SeasonCollectionView({
  seasonSlug,
  username,
  ownProfile,
}: {
  seasonSlug: string;
  username: string;
  ownProfile: boolean;
}) {
  const [layout, setLayout] = useState<CardsLayout>('grid');
  const filters = useCardsPageFilters({
    mode: ownProfile ? 'PROFILE_COLLECTION' : 'PUBLIC_PROFILE_COLLECTION',
    pageSize: 30,
  });
  const ownerKey = ownProfile ? 'me' : username;
  const endpoint = ownProfile
    ? `/api/v1/me/collection/seasons/${encodeURIComponent(seasonSlug)}`
    : `/api/v1/users/${encodeURIComponent(username)}/collection/seasons/${encodeURIComponent(seasonSlug)}`;
  const details = useQuery({
    queryKey: queryKeys.profileSeasonCollection(ownerKey, seasonSlug, filters.queryString),
    queryFn: () => apiFetch<SeasonCollectionDetails>(`${endpoint}?${filters.queryString}`),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const facets = useQuery({
    queryKey: queryKeys.cardFacets,
    queryFn: () => apiFetch<CardFacets>('/api/v1/card-facets'),
  });
  const backHref = profileHref(ownProfile ? undefined : username);
  const sortOptions = ownProfile
    ? seasonSortOptions
    : seasonSortOptions.filter(({ value }) => value !== '-quantity');

  if (details.isLoading && !details.data) return <Skeleton className="h-[42rem] w-full" />;
  if (details.isError || !details.data) {
    return (
      <ErrorState
        title="Collection indisponible"
        message="Cette saison n’est pas accessible."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>Retour au profil</Link>
          </Button>
        }
      />
    );
  }

  const data = details.data;
  return (
    <div>
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft className="size-4" /> Retour au profil
        </Link>
      </Button>
      <header className="mt-5 border-b border-border pb-6">
        <p className="text-xs font-semibold text-primary">{data.season.code ?? 'Saison Safir'}</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
          {data.season.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.collection.uniqueOwnedCards} carte
          {data.collection.uniqueOwnedCards > 1 ? 's' : ''} possédée
          {data.collection.uniqueOwnedCards > 1 ? 's' : ''}
          {data.collection.totalAvailableCards !== undefined
            ? ` sur ${data.collection.totalAvailableCards}`
            : ''}
          {data.collection.totalCopies !== undefined
            ? ` · ${data.collection.totalCopies} exemplaire${data.collection.totalCopies > 1 ? 's' : ''}`
            : ''}
        </p>
        {data.collection.completionPercentage !== undefined ? (
          <div className="mt-4 max-w-xl">
            <Progress
              value={data.collection.completionPercentage}
              label={`Progression de ${data.season.name}`}
            />
          </div>
        ) : null}
      </header>
      <div className="pt-6">
        <CardsToolbar
          mode={ownProfile ? 'PROFILE_COLLECTION' : 'PUBLIC_PROFILE_COLLECTION'}
          state={filters.state}
          search={filters.search}
          facets={facets.data}
          layout={layout}
          sortOptions={sortOptions}
          isFetching={details.isFetching && !details.isLoading}
          onSearchChange={filters.setSearch}
          onUpdate={filters.update}
          onReset={filters.reset}
          onLayoutChange={setLayout}
          showSeasonFilter={false}
          showOwnershipFilter={ownProfile}
        />
        <CardsGallery<SeasonCollectionCardItem>
          items={data.cards.data}
          loading={details.isLoading}
          error={details.isError}
          errorMessage="Impossible de charger cette saison."
          layout={layout}
          page={data.cards.pagination.page}
          pageCount={data.cards.pagination.pageCount}
          total={data.cards.pagination.total}
          hasFilters={filters.hasFilters}
          emptyTitle="Aucune carte dans cette saison"
          emptyDescription="Cette saison ne contient aucune carte publiée."
          filteredEmptyDescription="Modifiez les filtres pour afficher d’autres cartes."
          onRetry={() => void details.refetch()}
          onReset={filters.reset}
          onPageChange={(page) => filters.update({ page })}
          getKey={(item) => item.card.id}
          renderGridItem={(item) => <SeasonCollectionCard item={item} />}
          renderListItem={(item) => <SeasonCollectionListItem item={item} />}
        />
      </div>
    </div>
  );
}

function SeasonCollectionCard({ item }: { item: SeasonCollectionCardItem }) {
  const variant = item.ownedVariants[0];
  return (
    <div className={cn(!item.owned && 'opacity-65')}>
      <TcgCard
        card={{
          ...item.card,
          artworkPath: variant?.artworkPath ?? item.card.imageUrl ?? item.card.artworkPath,
        }}
        mode="collection"
        variantName={
          item.ownedVariants.length > 1
            ? `${item.ownedVariants.length} variantes`
            : (variant?.name ?? 'Non possédée')
        }
        quantity={item.quantity}
        lockedQuantity={item.lockedQuantity}
      />
    </div>
  );
}

function SeasonCollectionListItem({ item }: { item: SeasonCollectionCardItem }) {
  const variant = item.ownedVariants[0];
  return (
    <div className={cn('flex min-w-0 items-center gap-3', !item.owned && 'opacity-65')}>
      <div className="min-w-0 flex-1">
        <TcgCard card={item.card} mode="compact" variantName={variant?.name} />
      </div>
      <div className="shrink-0 pr-3 text-right text-xs text-muted-foreground">
        {item.quantity !== undefined ? <p className="font-semibold">× {item.quantity}</p> : null}
        <p>{item.owned ? 'Possédée' : 'Non possédée'}</p>
      </div>
    </div>
  );
}

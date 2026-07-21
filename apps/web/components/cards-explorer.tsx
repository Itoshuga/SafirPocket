'use client';

import type { CardFacets, CardListItem, PaginatedCardsResponse } from '@safir/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { catalogSortOptions, type CardsLayout } from '@/lib/cards-page';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { CardsGallery, CardsStats, CardsToolbar, useCardsPageFilters } from './cards-browser';
import { TcgCard } from './tcg-card';

export function CardsExplorer() {
  const [layout, setLayout] = useState<CardsLayout>('grid');
  const filters = useCardsPageFilters({ mode: 'CATALOG', pageSize: 30 });
  const cards = useQuery({
    queryKey: queryKeys.cards(filters.queryString),
    queryFn: () => apiFetch<PaginatedCardsResponse>(`/api/v1/cards?${filters.queryString}`),
    placeholderData: (previous) => previous,
  });
  const facets = useQuery({
    queryKey: queryKeys.cardFacets,
    queryFn: () => apiFetch<CardFacets>('/api/v1/card-facets'),
  });
  const catalogTotal =
    facets.data?.seasons.reduce((total, season) => total + (season.cardCount ?? 0), 0) ?? 0;

  return (
    <div>
      <CardsStats
        loading={cards.isLoading || facets.isLoading}
        items={[
          { label: 'Toutes les cartes', value: catalogTotal },
          {
            label: 'Résultats actuels',
            value: cards.data?.pagination.total ?? 0,
            hint: filters.hasFilters ? 'Filtres appliqués' : 'Catalogue complet',
          },
          { label: 'Saisons', value: facets.data?.seasons.length ?? 0 },
          { label: 'Raretés', value: facets.data?.rarities.length ?? 0 },
        ]}
      />
      <CardsToolbar
        mode="CATALOG"
        state={filters.state}
        search={filters.search}
        facets={facets.data}
        layout={layout}
        sortOptions={catalogSortOptions}
        isFetching={cards.isFetching && !cards.isLoading}
        onSearchChange={filters.setSearch}
        onUpdate={filters.update}
        onReset={filters.reset}
        onLayoutChange={setLayout}
      />
      <CardsGallery<CardListItem>
        items={cards.data?.data}
        loading={cards.isLoading}
        error={cards.isError}
        errorMessage="Le catalogue est momentanément indisponible. Vérifiez que l’API est démarrée."
        layout={layout}
        page={cards.data?.pagination.page ?? filters.state.page}
        pageCount={cards.data?.pagination.pageCount ?? 0}
        total={cards.data?.pagination.total ?? 0}
        hasFilters={filters.hasFilters}
        emptyTitle="Aucune carte disponible"
        emptyDescription="Les cartes publiées apparaîtront ici."
        filteredEmptyDescription="Modifiez la recherche ou retirez certains filtres."
        onRetry={() => void cards.refetch()}
        onReset={filters.reset}
        onPageChange={(page) => filters.update({ page })}
        getKey={(card) => card.id}
        renderGridItem={(card) => <TcgCard card={card} />}
        renderListItem={(card) => <CatalogCardListItem card={card} />}
      />
    </div>
  );
}

function CatalogCardListItem({ card }: { card: CardListItem }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <TcgCard card={card} mode="compact" />
      </div>
      <div className="hidden shrink-0 pr-3 text-right sm:block">
        <p className="text-sm font-medium text-foreground">{card.rarity.name}</p>
        <p className="text-xs text-muted-foreground">{card.season.name}</p>
      </div>
    </div>
  );
}

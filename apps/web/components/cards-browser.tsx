'use client';

import type { CardFacets, CardsPageMode, CardsSort } from '@safir/shared-types';
import {
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Tag,
  cn,
} from '@safir/ui';
import { Grid3X3, Layers3, List, LoaderCircle, RotateCcw, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildCardsApiQuery,
  hasCardsFilters,
  readCardsPageUrlState,
  updateCardsSearchParams,
  type CardsLayout,
  type CardsPageUrlState,
} from '@/lib/cards-page';
import { useAuth } from './auth-provider';

export function CardsHeaderAction({ mode }: { mode: CardsPageMode }) {
  const { user, loading } = useAuth();
  if (mode === 'CATALOG' && (!user || loading)) return null;
  if (mode === 'PUBLIC_PROFILE_COLLECTION') return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={mode === 'CATALOG' ? '/profile#collection' : '/cards'}>
        <Layers3 className="size-4" />
        {mode === 'CATALOG' ? 'Voir ma collection' : 'Toutes les cartes'}
      </Link>
    </Button>
  );
}

export function useCardsPageFilters({ mode, pageSize }: { mode: CardsPageMode; pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(
    () => readCardsPageUrlState(new URLSearchParams(searchParams.toString()), mode),
    [mode, searchParams],
  );
  const [search, setSearch] = useState(state.search);
  const deferredSearch = useDeferredValue(search);

  const update = useCallback(
    (values: Partial<Record<keyof CardsPageUrlState, string | number | null>>) => {
      const query = updateCardsSearchParams(new URLSearchParams(searchParams.toString()), values);
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const syncSearchFromHistory = () => {
      setSearch(new URLSearchParams(window.location.search).get('search') ?? '');
    };
    window.addEventListener('popstate', syncSearchFromHistory);
    return () => window.removeEventListener('popstate', syncSearchFromHistory);
  }, []);
  useEffect(() => {
    if (deferredSearch === state.search) return;
    update({ search: deferredSearch || null, page: 1 });
  }, [deferredSearch, state.search, update]);

  const queryState = { ...state, search: deferredSearch };
  const queryString = buildCardsApiQuery(queryState, pageSize);
  const reset = useCallback(() => {
    setSearch('');
    update({
      page: 1,
      search: null,
      season: null,
      rarity: null,
      type: null,
      commander: null,
      sort: null,
    });
  }, [update]);

  return {
    state: queryState,
    search,
    setSearch,
    update,
    reset,
    queryString,
    hasFilters: hasCardsFilters(queryState),
  };
}

interface CardsToolbarProps {
  mode: CardsPageMode;
  state: CardsPageUrlState;
  search: string;
  facets?: CardFacets;
  layout: CardsLayout;
  sortOptions: ReadonlyArray<{ value: CardsSort; label: string }>;
  isFetching?: boolean;
  onSearchChange: (value: string) => void;
  onUpdate: (values: Partial<Record<keyof CardsPageUrlState, string | number | null>>) => void;
  onReset: () => void;
  onLayoutChange: (layout: CardsLayout) => void;
}

export function CardsToolbar({
  mode,
  state,
  search,
  facets,
  layout,
  sortOptions,
  isFetching = false,
  onSearchChange,
  onUpdate,
  onReset,
  onLayoutChange,
}: CardsToolbarProps) {
  const activeFilters = [
    state.season
      ? {
          key: 'season' as const,
          label: facets?.seasons.find(({ slug }) => slug === state.season)?.name ?? state.season,
        }
      : null,
    state.rarity
      ? {
          key: 'rarity' as const,
          label: facets?.rarities.find(({ slug }) => slug === state.rarity)?.name ?? state.rarity,
        }
      : null,
    state.type
      ? {
          key: 'type' as const,
          label: facets?.types.find(({ slug }) => slug === state.type)?.name ?? state.type,
        }
      : null,
    state.commander
      ? {
          key: 'commander' as const,
          label: state.commander === 'true' ? 'Commandants' : 'Non-commandants',
        }
      : null,
  ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));

  const filterControls = (
    <div className="grid gap-4 lg:grid-cols-4">
      <label className="text-sm font-medium">
        Saison
        <Select
          className="mt-1.5"
          value={state.season}
          onChange={(event) => onUpdate({ season: event.target.value || null, page: 1 })}
        >
          <option value="">Toutes les saisons</option>
          {facets?.seasons.map((item) => (
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
          value={state.rarity}
          onChange={(event) => onUpdate({ rarity: event.target.value || null, page: 1 })}
        >
          <option value="">Toutes les raretés</option>
          {facets?.rarities.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name} ({item.cardCount ?? 0})
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Type
        <Select
          className="mt-1.5"
          value={state.type}
          onChange={(event) => onUpdate({ type: event.target.value || null, page: 1 })}
        >
          <option value="">Tous les types</option>
          {facets?.types.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name} ({item.cardCount ?? 0})
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Commandant
        <Select
          className="mt-1.5"
          value={state.commander}
          onChange={(event) => onUpdate({ commander: event.target.value || null, page: 1 })}
        >
          <option value="">Toutes les cartes</option>
          <option value="true">Commandants</option>
          <option value="false">Non-commandants</option>
        </Select>
      </label>
    </div>
  );

  return (
    <div
      className="mb-5 rounded-lg border border-border bg-surface p-4 shadow-control"
      data-testid="cards-toolbar"
    >
      <div className="grid items-center gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,15rem)_auto_auto]">
        <SearchInput
          aria-label={
            mode === 'CATALOG' ? 'Rechercher dans les cartes' : 'Rechercher dans la collection'
          }
          placeholder="Rechercher une carte…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange('')}
        />
        <Select
          aria-label={mode === 'CATALOG' ? 'Trier les cartes' : 'Trier la collection'}
          value={state.sort}
          onChange={(event) => onUpdate({ sort: event.target.value, page: 1 })}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Drawer
          title={mode === 'CATALOG' ? 'Filtrer les cartes' : 'Filtrer la collection'}
          trigger={
            <Button variant="outline" className="lg:hidden">
              <SlidersHorizontal className="size-4" />
              Filtres{activeFilters.length ? ` (${activeFilters.length})` : ''}
            </Button>
          }
          footer={
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="size-4" /> Réinitialiser
            </Button>
          }
        >
          {filterControls}
        </Drawer>
        <div
          className="flex w-fit rounded-md border border-border p-0.5"
          aria-label="Mode d’affichage"
        >
          <Button
            size="icon"
            variant={layout === 'grid' ? 'secondary' : 'ghost'}
            onClick={() => onLayoutChange('grid')}
            aria-label="Affichage en grille"
            aria-pressed={layout === 'grid'}
          >
            <Grid3X3 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={layout === 'list' ? 'secondary' : 'ghost'}
            onClick={() => onLayoutChange('list')}
            aria-label="Affichage en liste"
            aria-pressed={layout === 'list'}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 hidden border-t border-border pt-4 lg:block">{filterControls}</div>
      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2">
        {activeFilters.map((filter) => (
          <Tag
            key={filter.key}
            removable
            onRemove={() => onUpdate({ [filter.key]: null, page: 1 })}
          >
            {filter.label}
          </Tag>
        ))}
        {activeFilters.length ? (
          <Button variant="ghost" size="sm" onClick={onReset} className="hidden lg:inline-flex">
            <RotateCcw className="size-4" /> Réinitialiser
          </Button>
        ) : null}
        {isFetching ? (
          <span
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
          >
            <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
            Actualisation
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CardsStats({
  loading,
  items,
}: {
  loading: boolean;
  items: Array<{ label: string; value: ReactNode; hint?: ReactNode }>;
}) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {loading
        ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)
        : items.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
          ))}
    </div>
  );
}

export function CardsGallery<T>({
  items,
  loading,
  error,
  layout,
  page,
  pageCount,
  total,
  hasFilters,
  emptyTitle,
  emptyDescription,
  filteredEmptyDescription,
  errorMessage,
  emptyAction,
  onRetry,
  onReset,
  onPageChange,
  getKey,
  renderGridItem,
  renderListItem,
}: {
  items?: T[];
  loading: boolean;
  error: boolean;
  layout: CardsLayout;
  page: number;
  pageCount: number;
  total: number;
  hasFilters: boolean;
  emptyTitle: string;
  emptyDescription: string;
  filteredEmptyDescription: string;
  errorMessage: string;
  emptyAction?: ReactNode;
  onRetry: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  getKey: (item: T) => string;
  renderGridItem: (item: T) => ReactNode;
  renderListItem: (item: T) => ReactNode;
}) {
  if (loading) {
    return layout === 'grid' ? (
      <div className="grid grid-cols-2 gap-3 min-[430px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="aspect-[5/8]" />
        ))}
      </div>
    ) : (
      <div className="grid gap-1 rounded-lg border border-border bg-surface p-1">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        message={errorMessage}
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Réessayer
          </Button>
        }
      />
    );
  }
  if (!items?.length) {
    return (
      <EmptyState
        icon={<Layers3 className="size-5" />}
        title={hasFilters ? 'Aucune carte ne correspond à votre recherche' : emptyTitle}
        description={hasFilters ? filteredEmptyDescription : emptyDescription}
        action={
          hasFilters ? (
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="size-4" /> Réinitialiser les filtres
            </Button>
          ) : (
            emptyAction
          )
        }
      />
    );
  }
  return (
    <div aria-busy={false} data-testid="cards-results">
      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} résultat{total > 1 ? 's' : ''}
      </p>
      {layout === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 min-[430px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <div key={getKey(item)}>{renderGridItem(item)}</div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((item) => (
            <div key={getKey(item)} className={cn('min-w-0 p-1 sm:px-3')}>
              {renderListItem(item)}
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} />
    </div>
  );
}

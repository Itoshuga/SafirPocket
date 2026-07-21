import type { CardsPageMode, CatalogCardsSort, CollectionCardsSort } from '@safir/shared-types';

export type CardsLayout = 'grid' | 'list';
export type CommanderFilter = '' | 'true' | 'false';

export interface CardsPageUrlState {
  page: number;
  search: string;
  season: string;
  rarity: string;
  type: string;
  commander: CommanderFilter;
  sort: CatalogCardsSort | CollectionCardsSort;
}

export const catalogSortOptions: ReadonlyArray<{ value: CatalogCardsSort; label: string }> = [
  { value: 'number', label: 'Numéro croissant' },
  { value: '-number', label: 'Numéro décroissant' },
  { value: 'name', label: 'Nom A–Z' },
  { value: '-name', label: 'Nom Z–A' },
  { value: 'rarity', label: 'Rareté' },
  { value: 'season', label: 'Saison' },
  { value: '-createdAt', label: 'Date d’ajout' },
];

export const collectionSortOptions: ReadonlyArray<{
  value: CollectionCardsSort;
  label: string;
}> = [
  { value: 'recent', label: 'Obtention récente' },
  { value: 'number', label: 'Numéro croissant' },
  { value: '-number', label: 'Numéro décroissant' },
  { value: 'name', label: 'Nom A–Z' },
  { value: '-name', label: 'Nom Z–A' },
  { value: 'rarity', label: 'Rareté' },
  { value: 'season', label: 'Saison' },
  { value: '-quantity', label: 'Quantité possédée' },
];

const positivePage = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export function readCardsPageUrlState(
  params: URLSearchParams,
  mode: CardsPageMode,
): CardsPageUrlState {
  const options = mode === 'CATALOG' ? catalogSortOptions : collectionSortOptions;
  const fallback = mode === 'CATALOG' ? 'number' : 'recent';
  const requestedSort = params.get('sort') ?? fallback;
  const sort = options.some(({ value }) => value === requestedSort) ? requestedSort : fallback;
  const requestedCommander = params.get('commander');

  return {
    page: positivePage(params.get('page')),
    search: params.get('search') ?? '',
    season: params.get('season') ?? params.get('set') ?? '',
    rarity: params.get('rarity') ?? '',
    type: params.get('type') ?? '',
    commander:
      requestedCommander === 'true' || requestedCommander === 'false' ? requestedCommander : '',
    sort: sort as CatalogCardsSort | CollectionCardsSort,
  };
}

export function updateCardsSearchParams(
  current: URLSearchParams,
  values: Partial<Record<keyof CardsPageUrlState, string | number | null>>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === '') next.delete(key);
    else next.set(key, String(value));
  }
  if ('season' in values) next.delete('set');
  return next.toString();
}

export function buildCardsApiQuery(state: CardsPageUrlState, pageSize: number): string {
  const query = new URLSearchParams({
    page: String(state.page),
    pageSize: String(pageSize),
    sort: state.sort,
  });
  if (state.search) query.set('search', state.search);
  if (state.season) query.set('season', state.season);
  if (state.rarity) query.set('rarity', state.rarity);
  if (state.type) query.set('type', state.type);
  if (state.commander) query.set('isCommander', state.commander);
  return query.toString();
}

export function hasCardsFilters(state: CardsPageUrlState): boolean {
  return Boolean(state.search || state.season || state.rarity || state.type || state.commander);
}

import { describe, expect, it } from 'vitest';
import {
  buildCardsApiQuery,
  catalogSortOptions,
  collectionSortOptions,
  hasCardsFilters,
  readCardsPageUrlState,
  updateCardsSearchParams,
} from './cards-page';
import { queryKeys } from './query-keys';

describe('cards page filters', () => {
  it('reads catalogue filters from the URL and keeps the legacy set alias', () => {
    const state = readCardsPageUrlState(
      new URLSearchParams(
        'page=2&search=safir&set=origines&rarity=rare&type=allie&commander=true&sort=rarity',
      ),
      'CATALOG',
    );
    expect(state).toEqual({
      page: 2,
      search: 'safir',
      season: 'origines',
      rarity: 'rare',
      type: 'allie',
      commander: 'true',
      sort: 'rarity',
    });
    expect(buildCardsApiQuery(state, 30)).toContain('isCommander=true');
    expect(hasCardsFilters(state)).toBe(true);
  });

  it('normalizes invalid page, commander and sort values per mode', () => {
    const catalog = readCardsPageUrlState(
      new URLSearchParams('page=-4&commander=yes&sort=-quantity'),
      'CATALOG',
    );
    const collection = readCardsPageUrlState(
      new URLSearchParams('sort=-quantity'),
      'PROFILE_COLLECTION',
    );
    expect(catalog).toMatchObject({ page: 1, commander: '', sort: 'number' });
    expect(collection.sort).toBe('-quantity');
  });

  it('writes canonical season parameters and resets pagination', () => {
    const query = updateCardsSearchParams(new URLSearchParams('set=legacy&page=4'), {
      season: 'origines',
      page: 1,
    });
    const params = new URLSearchParams(query);
    expect(params.get('season')).toBe('origines');
    expect(params.has('set')).toBe(false);
    expect(params.get('page')).toBe('1');
  });

  it('keeps common and collection-only sort options explicit', () => {
    expect(catalogSortOptions.map(({ value }) => value)).toContain('season');
    expect(catalogSortOptions.map(({ value }) => value)).not.toContain('-quantity');
    expect(collectionSortOptions.map(({ value }) => value)).toContain('-quantity');
    expect(collectionSortOptions.map(({ value }) => value)).not.toContain('-createdAt');
  });

  it('uses distinct catalogue and collection query families', () => {
    expect(queryKeys.cards('page=1')).not.toEqual(queryKeys.collection('page=1'));
    expect(queryKeys.cards('page=1')[0]).toBe('cards');
    expect(queryKeys.collection('page=1')[0]).toBe('collection');
    expect(queryKeys.publicProfileCollection('Lucas', 'page=1')).not.toEqual(
      queryKeys.collection('page=1'),
    );
  });
});

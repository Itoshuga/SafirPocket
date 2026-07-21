import { describe, expect, it } from 'vitest';
import { seasonCollectionFiltersSchema, updateProfileBannerSchema } from './index.js';

describe('profile social validation', () => {
  it('accepts owned banner paths and crop positions within bounds', () => {
    expect(
      updateProfileBannerSchema.parse({
        bannerUrl: '11111111-1111-4111-8111-111111111111/banner.webp',
        bannerPositionY: 73,
      }),
    ).toEqual({
      bannerUrl: '11111111-1111-4111-8111-111111111111/banner.webp',
      bannerPositionY: 73,
    });
    expect(updateProfileBannerSchema.safeParse({ bannerPositionY: -1 }).success).toBe(false);
    expect(updateProfileBannerSchema.safeParse({ bannerPositionY: 101 }).success).toBe(false);
    expect(updateProfileBannerSchema.safeParse({}).success).toBe(false);
  });

  it('coerces detailed season filters and rejects unrelated season switching', () => {
    const parsed = seasonCollectionFiltersSchema.parse({
      page: '2',
      pageSize: '30',
      search: 'Sentinelle',
      rarity: 'rare',
      type: 'allie',
      isCommander: 'false',
      owned: 'true',
      sort: '-quantity',
      season: 'ignored-by-route',
    });
    expect(parsed).toEqual({
      page: 2,
      pageSize: 30,
      search: 'Sentinelle',
      rarity: 'rare',
      type: 'allie',
      isCommander: false,
      owned: true,
      sort: '-quantity',
    });
  });
});

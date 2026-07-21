import { describe, expect, it } from 'vitest';
import { profileHref, profileSeasonCollectionHref } from './profile-routes';

describe('profile collection routes', () => {
  it('builds the personal season route', () => {
    expect(
      profileSeasonCollectionHref({
        username: 'me',
        seasonSlug: 'saison-origines',
        ownProfile: true,
      }),
    ).toBe('/profile/collection/saison-origines');
    expect(profileHref()).toBe('/profile#collection');
  });

  it('encodes public usernames and season slugs', () => {
    expect(
      profileSeasonCollectionHref({
        username: 'Lucas Test',
        seasonSlug: 'été-2026',
        ownProfile: false,
      }),
    ).toBe('/users/Lucas%20Test/collection/%C3%A9t%C3%A9-2026');
    expect(profileHref('Lucas Test')).toBe('/users/Lucas%20Test#collection');
  });
});

import type { ProfileStats } from '@safir/shared-types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileStatsOverview, ProfileStatsSkeleton } from './profile-stats-overview';

const completeStats: ProfileStats = {
  collection: {
    uniqueCardsCount: 142,
    totalCopiesCount: 387,
    totalAvailableCardsCount: 248,
    missingCardsCount: 106,
    completionPercentage: 57.3,
  },
  social: { friendsCount: 24 },
  decks: { totalCount: 6 },
  game: {
    gamesPlayed: 48,
    winsCount: 31,
    lossesCount: 17,
    winRatePercentage: 64.6,
    currentRating: 1200,
    currentRank: 8,
  },
  visibility: {
    canViewCollectionStats: true,
    canViewGameStats: true,
    canViewFriendsCount: true,
  },
};

const renderOverview = (stats: ProfileStats, ownProfile: boolean) =>
  renderToStaticMarkup(createElement(ProfileStatsOverview, { stats, ownProfile }));

describe('ProfileStatsOverview', () => {
  it('renders the four main personal statistics with real destinations', () => {
    const html = renderOverview(completeStats, true);

    expect(html).toContain('Cartes uniques');
    expect(html).toContain('Cartes possédées');
    expect(html).toContain('Decks');
    expect(html).toContain('Amis');
    expect(html).toContain('href="#collection"');
    expect(html).toContain('href="/decks"');
    expect(html).toContain('href="/settings/friends"');
  });

  it('renders server progress and game activity without duplicating main values', () => {
    const html = renderOverview(completeStats, true);

    expect(html).toContain('Progression de la collection');
    expect(html).toContain('106 cartes à découvrir');
    expect(html).toContain('aria-valuenow="57.3"');
    expect(html).toContain('48 parties');
    expect(html).toContain('31 victoires');
    expect(html).toContain('64,6 % de victoire');
    expect(html).toContain('Classement #8');
  });

  it('adapts to two public statistics without exposing invalid links or hidden sections', () => {
    const publicStats: ProfileStats = {
      social: { friendsCount: 2 },
      decks: { totalCount: 1, publicCount: 1 },
      visibility: {
        canViewCollectionStats: false,
        canViewGameStats: false,
        canViewFriendsCount: true,
      },
    };
    const html = renderOverview(publicStats, false);

    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('Decks');
    expect(html).toContain('Amis');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('Progression de la collection');
    expect(html).not.toContain('Activité de jeu');
  });

  it('offers a discreet booster action to a new user only on their own profile', () => {
    const newUserStats: ProfileStats = {
      collection: {
        uniqueCardsCount: 0,
        totalCopiesCount: 0,
        totalAvailableCardsCount: 248,
        missingCardsCount: 248,
        completionPercentage: 0,
      },
      social: { friendsCount: 0 },
      decks: { totalCount: 0 },
      visibility: {
        canViewCollectionStats: true,
        canViewGameStats: true,
        canViewFriendsCount: true,
      },
    };

    expect(renderOverview(newUserStats, true)).toContain('Ouvrir un booster');
    expect(renderOverview(newUserStats, false)).not.toContain('Ouvrir un booster');
  });

  it('uses a compact skeleton with four statistic placeholders and one progress line', () => {
    const html = renderToStaticMarkup(createElement(ProfileStatsSkeleton));
    expect(html.match(/data-testid="profile-stat-skeleton"/g)).toHaveLength(4);
    expect(html).toContain('Chargement des statistiques du profil');
  });
});

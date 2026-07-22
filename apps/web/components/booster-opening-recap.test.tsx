import type { PackOpening } from '@safir/shared-types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BoosterOpeningRecapList } from './booster-opening-recap';

const opening: PackOpening = {
  id: 'opening-1',
  booster: {
    id: 'booster-1',
    name: 'Origines',
    imageUrl: null,
    season: { id: 'season-1', name: 'Origines', slug: 'origines', code: 'ORI' },
  },
  status: 'completed',
  cost: { amount: 0, currencyCode: null },
  openedAt: '2026-07-22T10:00:00.000Z',
  cards: Array.from({ length: 8 }, (_, index) => ({
    slotPosition: index + 1,
    slotCategory: index < 6 ? ('COMMON' as const) : ('PREMIUM' as const),
    card: {
      id: `card-${index}`,
      name: `Carte ${index + 1}`,
      number: index + 1,
      imageUrl: null,
      attack: 1,
      defense: 1,
      value: 1,
    },
    variant: {
      id: `variant-${index}`,
      name: 'Standard',
      slug: 'standard',
      finish: 'standard',
      artworkPath: null,
    },
    rarity: {
      id: index < 6 ? 'common' : 'rare',
      name: index < 6 ? 'Commune' : 'Rare',
      slug: index < 6 ? 'commune' : 'rare',
      displayColor: null,
    },
    previousQuantity: index,
    newQuantity: index + 1,
    isNew: index === 0,
  })),
};

describe('BoosterOpeningRecapList', () => {
  it('renders eight ordered list rows with quantities and server slot categories', () => {
    const html = renderToStaticMarkup(createElement(BoosterOpeningRecapList, { opening }));

    expect(html.match(/<li[ >]/g)).toHaveLength(8);
    expect(html.match(/data-slot-category="COMMON"/g)).toHaveLength(6);
    expect(html.match(/data-slot-category="PREMIUM"/g)).toHaveLength(2);
    expect(html).toContain('Carte 1');
    expect(html).toContain('Nouvelle');
    expect(html).toContain('0 -&gt; 1');
    expect(html).toContain('7 -&gt; 8');
  });
});

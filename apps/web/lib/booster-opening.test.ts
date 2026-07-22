import type { PackOpening, PackOpeningCard } from '@safir/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boosterOpeningReducer,
  clearOtherStoredOpeningProgress,
  consumeFreshOpeningMarker,
  createBoosterOpeningState,
  decideBoosterOpeningEntry,
  evaluateCardGesture,
  evaluateCutGesture,
  isSignificantOpeningProgress,
  normalizePackOpening,
  parseStoredOpeningProgress,
  readStoredOpeningProgress,
  rarityEmphasis,
  type StoredBoosterOpeningProgress,
} from './booster-opening';

const now = Date.parse('2026-07-22T12:00:00.000Z');

function progress(overrides: Partial<StoredBoosterOpeningProgress> = {}) {
  return {
    version: 1 as const,
    openingId: 'opening-1',
    phase: 'CARD_REVEAL' as const,
    currentCardIndex: 2,
    revealedSlotPositions: [1, 2, 3],
    packWasCut: true,
    updatedAt: new Date(now).toISOString(),
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  } as Storage;
}

afterEach(() => vi.unstubAllGlobals());

function card(index: number): PackOpeningCard {
  return {
    slotPosition: index + 1,
    slotCategory: index < 6 ? 'COMMON' : 'PREMIUM',
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
    previousQuantity: 0,
    newQuantity: 1,
    isNew: true,
  };
}

function opening(cards = Array.from({ length: 8 }, (_, index) => card(index))): PackOpening {
  return {
    id: 'opening-1',
    booster: {
      id: 'booster-1',
      name: 'Origines',
      imageUrl: null,
      season: { id: 'season-1', name: 'Origines', slug: 'origines', code: 'ORI' },
    },
    status: 'completed',
    cost: { amount: 100, currencyCode: 'SAFIR' },
    openedAt: '2026-07-22T10:00:00.000Z',
    cards,
  };
}

describe('booster opening sequence', () => {
  it('accepts horizontal cut and card gestures in both directions', () => {
    expect(evaluateCutGesture({ deltaX: 170, elapsedMs: 900 })).toMatchObject({
      completed: true,
      direction: 1,
    });
    expect(evaluateCutGesture({ deltaX: -60, elapsedMs: 60 })).toMatchObject({
      completed: true,
      direction: -1,
    });
    expect(evaluateCardGesture({ deltaX: -130, elapsedMs: 700 })).toMatchObject({
      completed: true,
      direction: -1,
    });
    expect(evaluateCardGesture({ deltaX: 18, elapsedMs: 200 })).toMatchObject({
      completed: false,
      direction: 1,
    });
  });

  it('runs from loading through all eight cards to the recap', () => {
    let state = createBoosterOpeningState();
    state = boosterOpeningReducer(state, { type: 'RESULT_LOADED', mode: 'fresh' });
    state = boosterOpeningReducer(state, { type: 'ASSETS_READY' });
    expect(state.phase).toBe('READY_TO_CUT');
    state = boosterOpeningReducer(state, { type: 'START_CUT' });
    state = boosterOpeningReducer(state, { type: 'COMPLETE_CUT' });
    state = boosterOpeningReducer(state, { type: 'SHOW_CARDS' });
    state = boosterOpeningReducer(state, { type: 'REVEAL_CARD' });

    for (let index = 0; index < 8; index += 1) {
      state = boosterOpeningReducer(state, { type: 'ADVANCE_CARD', direction: index % 2 ? -1 : 1 });
      state = boosterOpeningReducer(state, { type: 'FINISH_CARD_TRANSITION' });
    }

    expect(state.phase).toBe('RECAP');
    expect(state.currentCardIndex).toBe(7);
  });

  it('resumes a persisted reveal without replaying the transaction', () => {
    let state = createBoosterOpeningState();
    state = boosterOpeningReducer(state, {
      type: 'RESULT_LOADED',
      mode: 'resume-choice',
      storedProgress: progress({
        currentCardIndex: 4,
        revealedSlotPositions: [1, 2, 3, 4, 5],
      }),
    });
    state = boosterOpeningReducer(state, { type: 'ASSETS_READY' });
    expect(state.resumeChoiceOpen).toBe(true);
    state = boosterOpeningReducer(state, { type: 'CHOOSE_RESUME' });
    expect(state).toMatchObject({ phase: 'CARD_REVEAL', currentCardIndex: 4 });
  });
});

describe('booster opening entry decision', () => {
  it('starts directly as fresh when no significant progress exists', () => {
    expect(decideBoosterOpeningEntry({ hasFreshMarker: false, storedProgress: null })).toBe(
      'fresh',
    );
  });

  it('gives a fresh marker priority over stale progress and stays idempotent', () => {
    const input = { hasFreshMarker: true, storedProgress: progress() };
    expect(decideBoosterOpeningEntry(input)).toBe('fresh');
    expect(decideBoosterOpeningEntry(input)).toBe('fresh');
  });

  it('offers resume only for validated, significant progress', () => {
    expect(isSignificantOpeningProgress(progress())).toBe(true);
    expect(decideBoosterOpeningEntry({ hasFreshMarker: false, storedProgress: progress() })).toBe(
      'resume-choice',
    );
  });

  it('prioritizes recap and replay routes over local state', () => {
    expect(
      decideBoosterOpeningEntry({
        requestedMode: 'recap',
        hasFreshMarker: true,
        storedProgress: progress(),
      }),
    ).toBe('recap');
    expect(
      decideBoosterOpeningEntry({
        requestedMode: 'replay',
        hasFreshMarker: false,
        storedProgress: progress(),
      }),
    ).toBe('replay');
  });
});

describe('persisted booster opening progress', () => {
  it('accepts coherent progress for the matching opening', () => {
    expect(parseStoredOpeningProgress(JSON.stringify(progress()), 'opening-1', now)).toEqual(
      progress(),
    );
  });

  it('rejects another opening, an old format and expired data', () => {
    expect(parseStoredOpeningProgress(JSON.stringify(progress()), 'opening-2', now)).toBeNull();
    expect(
      parseStoredOpeningProgress(
        JSON.stringify({ openingId: 'opening-1', packOpened: true, completed: false }),
        'opening-1',
        now,
      ),
    ).toBeNull();
    expect(
      parseStoredOpeningProgress(
        JSON.stringify(progress({ updatedAt: '2026-07-01T12:00:00.000Z' })),
        'opening-1',
        now,
      ),
    ).toBeNull();
  });

  it('rejects malformed indexes, slots and timestamps', () => {
    expect(
      parseStoredOpeningProgress(
        JSON.stringify(progress({ currentCardIndex: 8 })),
        'opening-1',
        now,
      ),
    ).toBeNull();
    expect(
      parseStoredOpeningProgress(
        JSON.stringify(progress({ currentCardIndex: 1, revealedSlotPositions: [1, 3] })),
        'opening-1',
        now,
      ),
    ).toBeNull();
    expect(
      parseStoredOpeningProgress(
        JSON.stringify(progress({ updatedAt: 'not-a-date' })),
        'opening-1',
        now,
      ),
    ).toBeNull();
  });

  it('removes invalid local data and consumes a fresh marker only once', () => {
    const localStorage = memoryStorage({
      'safir:booster-opening:opening-1': JSON.stringify({ openingId: 'other-opening' }),
    });
    const sessionStorage = memoryStorage({
      'safir:booster-opening:fresh:opening-1': 'true',
    });
    vi.stubGlobal('window', { localStorage, sessionStorage });

    expect(readStoredOpeningProgress('opening-1')).toBeNull();
    expect(localStorage.getItem('safir:booster-opening:opening-1')).toBeNull();
    expect(consumeFreshOpeningMarker('opening-1')).toBe(true);
    expect(consumeFreshOpeningMarker('opening-1')).toBe(false);
  });

  it('cleans progress from another opening when a new one starts', () => {
    const localStorage = memoryStorage({
      'safir:booster-opening:opening-1': JSON.stringify(progress()),
      'safir:booster-opening:opening-2': JSON.stringify(progress({ openingId: 'opening-2' })),
      'unrelated-setting': 'keep-me',
    });
    vi.stubGlobal('window', { localStorage, sessionStorage: memoryStorage() });

    clearOtherStoredOpeningProgress('opening-2');

    expect(localStorage.getItem('safir:booster-opening:opening-1')).toBeNull();
    expect(localStorage.getItem('safir:booster-opening:opening-2')).not.toBeNull();
    expect(localStorage.getItem('unrelated-setting')).toBe('keep-me');
  });
});

describe('normalizePackOpening', () => {
  it('sorts a valid server result by slot', () => {
    const reversed = opening([...opening().cards].reverse());
    expect(normalizePackOpening(reversed).cards.map((item) => item.slotPosition)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('rejects missing, duplicated and miscategorized slots', () => {
    expect(() => normalizePackOpening(opening(opening().cards.slice(0, 7)))).toThrow(
      'exactement huit cartes',
    );
    const duplicated = opening().cards.map((item, index) =>
      index === 7 ? { ...item, slotPosition: 7 } : item,
    );
    expect(() => normalizePackOpening(opening(duplicated))).toThrow('incomplets ou dupliqués');
    const wrongCategory = opening().cards.map((item, index) =>
      index === 6 ? { ...item, slotCategory: 'COMMON' as const } : item,
    );
    expect(() => normalizePackOpening(opening(wrongCategory))).toThrow(
      "catégorie d'un emplacement",
    );
  });

  it('only emphasizes premium slots and derives exceptional styling from real rarity', () => {
    expect(rarityEmphasis(card(0))).toBe('neutral');
    expect(rarityEmphasis(card(6))).toBe('premium');
    const legendary = {
      ...card(7),
      rarity: { ...card(7).rarity, name: 'Légendaire', slug: 'legendaire' },
    };
    expect(rarityEmphasis(legendary)).toBe('exceptional');
  });
});

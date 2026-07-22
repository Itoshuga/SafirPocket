import type { PackOpening, PackOpeningCard } from '@safir/shared-types';

export const BOOSTER_OPENING_CARD_COUNT = 8;
export const BOOSTER_COMMON_CARD_COUNT = 6;

export const BOOSTER_GESTURE_THRESHOLDS = {
  cutDistance: 156,
  cutVelocity: 0.72,
  cutVelocityMinimumDistance: 48,
  cardDistance: 112,
  cardVelocity: 0.64,
  cardVelocityMinimumDistance: 42,
} as const;

export const BOOSTER_ASSET_TIMEOUT_MS = 8_000;
export const BOOSTER_PROGRESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export type BoosterOpeningPhase =
  | 'LOADING_RESULT'
  | 'PRELOADING_ASSETS'
  | 'READY_TO_CUT'
  | 'CUTTING'
  | 'PACK_OPENED'
  | 'CARDS_EMERGING'
  | 'CARD_REVEAL'
  | 'TRANSITIONING_CARD'
  | 'RECAP'
  | 'COMPLETED'
  | 'ERROR';

export type BoosterOpeningEntryMode = 'fresh' | 'resume-choice' | 'recap' | 'replay';
export type GestureDirection = -1 | 1;

export interface StoredBoosterOpeningProgress {
  version: 1;
  openingId: string;
  phase: Extract<
    BoosterOpeningPhase,
    'PACK_OPENED' | 'CARDS_EMERGING' | 'CARD_REVEAL' | 'TRANSITIONING_CARD'
  >;
  currentCardIndex: number;
  revealedSlotPositions: number[];
  packWasCut: boolean;
  updatedAt: string;
}

export interface BoosterOpeningState {
  phase: BoosterOpeningPhase;
  entryMode: BoosterOpeningEntryMode;
  cutProgress: number;
  currentCardIndex: number;
  transitionDirection: GestureDirection;
  resumePackOpened: boolean;
  resumeChoiceOpen: boolean;
  exitConfirmationOpen: boolean;
  errorMessage: string | null;
}

export type BoosterOpeningAction =
  | {
      type: 'RESULT_LOADED';
      mode: BoosterOpeningEntryMode;
      storedProgress?: StoredBoosterOpeningProgress | null;
    }
  | { type: 'ASSETS_READY' }
  | { type: 'START_CUT' }
  | { type: 'UPDATE_CUT'; progress: number }
  | { type: 'RESET_CUT' }
  | { type: 'COMPLETE_CUT' }
  | { type: 'SHOW_CARDS' }
  | { type: 'REVEAL_CARD' }
  | { type: 'ADVANCE_CARD'; direction: GestureDirection }
  | { type: 'FINISH_CARD_TRANSITION' }
  | { type: 'CHOOSE_RESUME' }
  | { type: 'SHOW_RECAP' }
  | { type: 'CLOSE_RECAP' }
  | { type: 'REOPEN_RECAP' }
  | { type: 'REQUEST_EXIT' }
  | { type: 'CANCEL_EXIT' }
  | { type: 'FAIL'; message: string }
  | { type: 'RETRY' };

export function createBoosterOpeningState(): BoosterOpeningState {
  return {
    phase: 'LOADING_RESULT',
    entryMode: 'fresh',
    cutProgress: 0,
    currentCardIndex: 0,
    transitionDirection: 1,
    resumePackOpened: false,
    resumeChoiceOpen: false,
    exitConfirmationOpen: false,
    errorMessage: null,
  };
}

export function boosterOpeningReducer(
  state: BoosterOpeningState,
  action: BoosterOpeningAction,
): BoosterOpeningState {
  switch (action.type) {
    case 'RESULT_LOADED':
      return {
        ...state,
        phase: 'PRELOADING_ASSETS',
        entryMode: action.mode,
        currentCardIndex: clampCardIndex(action.storedProgress?.currentCardIndex ?? 0),
        resumePackOpened: Boolean(action.storedProgress?.packWasCut),
        resumeChoiceOpen: false,
        errorMessage: null,
      };
    case 'ASSETS_READY':
      if (state.entryMode === 'recap') return { ...state, phase: 'RECAP' };
      if (state.entryMode === 'resume-choice') {
        return { ...state, phase: 'READY_TO_CUT', resumeChoiceOpen: true };
      }
      return { ...state, phase: 'READY_TO_CUT', currentCardIndex: 0, cutProgress: 0 };
    case 'CHOOSE_RESUME':
      return {
        ...state,
        phase: state.resumePackOpened ? 'CARD_REVEAL' : 'READY_TO_CUT',
        resumeChoiceOpen: false,
      };
    case 'START_CUT':
      if (state.phase !== 'READY_TO_CUT' && state.phase !== 'CUTTING') return state;
      return { ...state, phase: 'CUTTING' };
    case 'UPDATE_CUT':
      if (state.phase !== 'CUTTING') return state;
      return { ...state, cutProgress: clamp(action.progress, 0, 1) };
    case 'RESET_CUT':
      if (state.phase !== 'CUTTING') return state;
      return { ...state, phase: 'READY_TO_CUT', cutProgress: 0 };
    case 'COMPLETE_CUT':
      if (state.phase !== 'CUTTING' && state.phase !== 'READY_TO_CUT') return state;
      return { ...state, phase: 'PACK_OPENED', cutProgress: 1 };
    case 'SHOW_CARDS':
      if (state.phase !== 'PACK_OPENED') return state;
      return { ...state, phase: 'CARDS_EMERGING' };
    case 'REVEAL_CARD':
      if (state.phase !== 'CARDS_EMERGING') return state;
      return { ...state, phase: 'CARD_REVEAL' };
    case 'ADVANCE_CARD':
      if (state.phase !== 'CARD_REVEAL') return state;
      return { ...state, phase: 'TRANSITIONING_CARD', transitionDirection: action.direction };
    case 'FINISH_CARD_TRANSITION':
      if (state.phase !== 'TRANSITIONING_CARD') return state;
      if (state.currentCardIndex >= BOOSTER_OPENING_CARD_COUNT - 1) {
        return { ...state, phase: 'RECAP' };
      }
      return { ...state, phase: 'CARD_REVEAL', currentCardIndex: state.currentCardIndex + 1 };
    case 'SHOW_RECAP':
      return { ...state, phase: 'RECAP', resumeChoiceOpen: false, exitConfirmationOpen: false };
    case 'CLOSE_RECAP':
      if (state.phase !== 'RECAP') return state;
      return { ...state, phase: 'COMPLETED' };
    case 'REOPEN_RECAP':
      if (state.phase !== 'COMPLETED') return state;
      return { ...state, phase: 'RECAP' };
    case 'REQUEST_EXIT':
      if (state.phase === 'RECAP' || state.phase === 'COMPLETED') return state;
      return { ...state, exitConfirmationOpen: true };
    case 'CANCEL_EXIT':
      return { ...state, exitConfirmationOpen: false };
    case 'FAIL':
      return { ...state, phase: 'ERROR', errorMessage: action.message };
    case 'RETRY':
      return { ...createBoosterOpeningState(), entryMode: state.entryMode };
    default:
      return state;
  }
}

export interface HorizontalGestureSample {
  deltaX: number;
  elapsedMs: number;
}

export interface HorizontalGestureResult {
  completed: boolean;
  direction: GestureDirection;
  progress: number;
  velocity: number;
}

export function evaluateCutGesture(sample: HorizontalGestureSample): HorizontalGestureResult {
  return evaluateHorizontalGesture(
    sample,
    BOOSTER_GESTURE_THRESHOLDS.cutDistance,
    BOOSTER_GESTURE_THRESHOLDS.cutVelocity,
    BOOSTER_GESTURE_THRESHOLDS.cutVelocityMinimumDistance,
  );
}

export function evaluateCardGesture(sample: HorizontalGestureSample): HorizontalGestureResult {
  return evaluateHorizontalGesture(
    sample,
    BOOSTER_GESTURE_THRESHOLDS.cardDistance,
    BOOSTER_GESTURE_THRESHOLDS.cardVelocity,
    BOOSTER_GESTURE_THRESHOLDS.cardVelocityMinimumDistance,
  );
}

function evaluateHorizontalGesture(
  sample: HorizontalGestureSample,
  distanceThreshold: number,
  velocityThreshold: number,
  velocityMinimumDistance: number,
): HorizontalGestureResult {
  const distance = Math.abs(sample.deltaX);
  const elapsedMs = Math.max(sample.elapsedMs, 1);
  const velocity = distance / elapsedMs;
  return {
    completed:
      distance >= distanceThreshold ||
      (distance >= velocityMinimumDistance && velocity >= velocityThreshold),
    direction: sample.deltaX < 0 ? -1 : 1,
    progress: clamp(distance / distanceThreshold, 0, 1),
    velocity,
  };
}

export function normalizePackOpening(opening: PackOpening): PackOpening {
  if (opening.status !== 'completed') {
    throw new Error("Cette ouverture n'est pas terminée.");
  }
  if (opening.cards.length !== BOOSTER_OPENING_CARD_COUNT) {
    throw new Error("Le résultat d'ouverture doit contenir exactement huit cartes.");
  }
  const cards = [...opening.cards].sort((left, right) => left.slotPosition - right.slotPosition);
  cards.forEach((item, index) => validateOpeningCard(item, index + 1));
  return { ...opening, cards };
}

function validateOpeningCard(item: PackOpeningCard, expectedPosition: number) {
  if (item.slotPosition !== expectedPosition) {
    throw new Error('Les emplacements du booster sont incomplets ou dupliqués.');
  }
  const expectedCategory = expectedPosition <= BOOSTER_COMMON_CARD_COUNT ? 'COMMON' : 'PREMIUM';
  if (item.slotCategory !== expectedCategory) {
    throw new Error("La catégorie d'un emplacement ne correspond pas au résultat serveur.");
  }
}

export function openingProgressStorageKey(openingId: string) {
  return `safir:booster-opening:${openingId}`;
}

export function freshOpeningSessionKey(openingId: string) {
  return `safir:booster-opening:fresh:${openingId}`;
}

export function decideBoosterOpeningEntry({
  requestedMode,
  hasFreshMarker,
  storedProgress,
}: {
  requestedMode?: 'recap' | 'replay';
  hasFreshMarker: boolean;
  storedProgress: StoredBoosterOpeningProgress | null;
}): BoosterOpeningEntryMode {
  if (requestedMode === 'recap') return 'recap';
  if (requestedMode === 'replay') return 'replay';
  if (hasFreshMarker) return 'fresh';
  if (storedProgress && isSignificantOpeningProgress(storedProgress)) return 'resume-choice';
  return 'fresh';
}

export function isSignificantOpeningProgress(progress: StoredBoosterOpeningProgress) {
  return (
    progress.packWasCut ||
    progress.currentCardIndex > 0 ||
    progress.revealedSlotPositions.length > 0
  );
}

export function consumeFreshOpeningMarker(openingId: string) {
  if (typeof window === 'undefined') return false;
  const key = freshOpeningSessionKey(openingId);
  const isFresh = window.sessionStorage.getItem(key) === 'true';
  window.sessionStorage.removeItem(key);
  return isFresh;
}

export function readStoredOpeningProgress(openingId: string): StoredBoosterOpeningProgress | null {
  if (typeof window === 'undefined') return null;
  const key = openingProgressStorageKey(openingId);
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    const progress = parseStoredOpeningProgress(value, openingId);
    if (!progress) window.localStorage.removeItem(key);
    return progress;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function parseStoredOpeningProgress(
  value: string,
  openingId: string,
  now = Date.now(),
): StoredBoosterOpeningProgress | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredBoosterOpeningProgress>;
    if (parsed.version !== 1 || parsed.openingId !== openingId) return null;
    if (
      parsed.phase !== 'PACK_OPENED' &&
      parsed.phase !== 'CARDS_EMERGING' &&
      parsed.phase !== 'CARD_REVEAL' &&
      parsed.phase !== 'TRANSITIONING_CARD'
    ) {
      return null;
    }
    if (
      !Number.isInteger(parsed.currentCardIndex) ||
      parsed.currentCardIndex === undefined ||
      parsed.currentCardIndex < 0 ||
      parsed.currentCardIndex >= BOOSTER_OPENING_CARD_COUNT ||
      parsed.packWasCut !== true ||
      !Array.isArray(parsed.revealedSlotPositions)
    ) {
      return null;
    }
    const revealed = parsed.revealedSlotPositions;
    if (
      revealed.some(
        (position) =>
          !Number.isInteger(position) ||
          position < 1 ||
          position > BOOSTER_OPENING_CARD_COUNT ||
          position > parsed.currentCardIndex! + 1,
      ) ||
      new Set(revealed).size !== revealed.length
    ) {
      return null;
    }
    const updatedAt = typeof parsed.updatedAt === 'string' ? Date.parse(parsed.updatedAt) : NaN;
    if (
      !Number.isFinite(updatedAt) ||
      updatedAt > now + 5 * 60 * 1_000 ||
      now - updatedAt > BOOSTER_PROGRESS_MAX_AGE_MS
    ) {
      return null;
    }
    return {
      version: 1,
      openingId,
      phase: parsed.phase,
      currentCardIndex: parsed.currentCardIndex,
      revealedSlotPositions: [...revealed].sort((left, right) => left - right),
      packWasCut: true,
      updatedAt: new Date(updatedAt).toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeStoredOpeningProgress(progress: StoredBoosterOpeningProgress) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    openingProgressStorageKey(progress.openingId),
    JSON.stringify(progress),
  );
}

export function removeStoredOpeningProgress(openingId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(openingProgressStorageKey(openingId));
}

export function clearOtherStoredOpeningProgress(openingId: string) {
  if (typeof window === 'undefined') return;
  const currentKey = openingProgressStorageKey(openingId);
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith('safir:booster-opening:') && key !== currentKey) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

export function resolveOpeningCardImage(item: PackOpeningCard): string | null {
  const source = item.variant.artworkPath ?? item.card.imageUrl;
  if (!source) return null;
  if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('/')) {
    return source;
  }
  return `/artwork/card/${source.split('/').map(encodeURIComponent).join('/')}`;
}

export function openingAssetUrls(opening: PackOpening): string[] {
  return [opening.booster.imageUrl, ...opening.cards.map(resolveOpeningCardImage)].filter(
    (value): value is string => Boolean(value),
  );
}

export function rarityEmphasis(item: PackOpeningCard): 'neutral' | 'premium' | 'exceptional' {
  if (item.slotCategory !== 'PREMIUM') return 'neutral';
  const rarity = `${item.rarity.slug} ${item.rarity.name}`.toLocaleLowerCase('fr');
  if (/(legend|myth|unique|exclusive|secr[eè]te|ultra)/u.test(rarity)) return 'exceptional';
  return 'premium';
}

function clampCardIndex(index: number) {
  return Math.trunc(clamp(index, 0, BOOSTER_OPENING_CARD_COUNT - 1));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

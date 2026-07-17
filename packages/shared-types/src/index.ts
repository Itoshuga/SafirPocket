export type UserRole = 'user' | 'moderator' | 'admin';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  bio: string | null;
  role: UserRole;
  createdAt?: string;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
    fieldErrors?: Record<string, string[]>;
  };
}

export type PublicationStatus = 'draft' | 'published' | 'archived';

export interface CardSetSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  code: string;
  releaseDate: string | null;
  cardCount?: number;
}

export interface CardSummary {
  id: string;
  setId: string;
  name: string;
  slug: string;
  collectionNumber: string;
  rarity: string;
  cardType: string;
  cost: number | null;
  artworkPath: string | null;
  status: PublicationStatus;
  set?: Pick<CardSetSummary, 'id' | 'name' | 'slug' | 'code'>;
}

export interface CardDetail extends CardSummary {
  description: string | null;
  effectText: string | null;
  stats: Record<string, unknown>;
  effects: CardEffectDefinition[];
  metadata: Record<string, unknown>;
  variants: CardVariantSummary[];
}

export interface CardVariantSummary {
  id: string;
  cardId: string;
  name: string;
  slug: string;
  finish: string;
  artworkPath: string | null;
}

export interface CardFacets {
  sets: CardSetSummary[];
  rarities: string[];
  types: string[];
}

export interface CardEffectDefinition {
  effectId: 'DRAW_CARDS' | 'DEAL_DAMAGE' | 'HEAL_TARGET';
  version: number;
  params: Record<string, unknown>;
}

export interface DeckSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  visibility: 'private' | 'unlisted' | 'public';
  format: string;
  cardCount: number;
  uniqueCardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeckCardEntry {
  cardVariantId: string;
  quantity: number;
  cardVariant: CardVariantSummary & { card: CardSummary };
}

export interface DeckDetail extends DeckSummary {
  cards: DeckCardEntry[];
  validation: {
    valid: boolean;
    warnings: string[];
  };
}

export interface CollectionEntry {
  cardVariantId: string;
  quantity: number;
  lockedQuantity: number;
  firstObtainedAt: string;
  lastObtainedAt: string;
  variant: {
    id: string;
    name: string;
    finish: string;
    artworkPath: string | null;
    card: CardSummary;
  };
}

export interface CollectionSummary {
  totalCopies: number;
  uniqueVariants: number;
  uniqueCards: number;
  completionRate: number;
  publishedCardCount: number;
  favoriteRarity: string | null;
  sets: Array<{
    id: string;
    name: string;
    slug: string;
    code: string;
    ownedCards: number;
    cardCount: number;
    missingCards: number;
    completionRate: number;
  }>;
}

export interface CardCollectionContext {
  totalQuantity: number;
  lockedQuantity: number;
  variants: Array<{
    cardVariantId: string;
    variantName: string;
    quantity: number;
    lockedQuantity: number;
  }>;
  decks: Array<{
    id: string;
    name: string;
    quantity: number;
    variantName: string;
  }>;
}

export interface ProfileSummary {
  collection: Omit<CollectionSummary, 'sets'>;
  deckCount: number;
  matchCount: number;
  wins: number;
  currentRating: number | null;
  currentRank: number | null;
}

export interface BoosterProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  artworkPath: string | null;
  priceCurrency: string;
  priceAmount: string;
  cardsPerPack: number;
  availableUntil: string | null;
  possibleCards: Array<{
    variantId: string;
    variantName: string;
    card: CardSummary;
  }>;
}

export interface BoosterOpening {
  id: string;
  product: Pick<BoosterProductSummary, 'id' | 'name' | 'slug' | 'artworkPath'>;
  status: 'pending' | 'completed' | 'failed';
  priceCurrency: string;
  priceAmount: string;
  openedAt: string | null;
  cards: Array<{
    quantity: number;
    variant: CardVariantSummary & { card: CardSummary };
  }>;
}

export interface WalletSummary {
  currencyCode: string;
  balance: string;
  updatedAt: string;
}

export interface RankedSeasonSummary {
  id: string;
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
}

export interface RankingEntry {
  rank: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  user: PublicUser;
}

export interface RankingsResponse extends PaginatedResponse<RankingEntry> {
  season: RankedSeasonSummary | null;
}

export interface AdminOverview {
  status: 'ready';
  counts: {
    publishedSets: number;
    publishedCards: number;
    publishedBoosters: number;
    activeMatches: number;
    profiles: number;
  };
  generatedAt: string;
}

export interface MatchSnapshot {
  matchId: string;
  sequence: number;
  rulesVersion: string;
  phase: string;
  activePlayerId: string | null;
  state: Record<string, unknown>;
}

export interface MatchActionIntent {
  actionId: string;
  matchId: string;
  expectedSequence: number;
  type: 'PASS_PRIORITY' | 'PLAY_CARD' | 'TECHNICAL_DRAW';
  payload: Record<string, unknown>;
}

export interface ClientToServerEvents {
  'queue:join': (payload: QueueJoinPayload) => void;
  'queue:leave': (payload: QueueLeavePayload) => void;
  'match:ready': (payload: MatchReadyPayload) => void;
  'match:action': (payload: MatchActionIntent) => void;
  'match:forfeit': (payload: MatchReferencePayload) => void;
  'match:resync': (payload: MatchResyncPayload) => void;
}

export interface ServerToClientEvents {
  'queue:joined': (payload: { format: string; joinedAt: string }) => void;
  'queue:left': (payload: { format: string }) => void;
  'match:found': (payload: { matchId: string; opponent: PublicUser }) => void;
  'match:state': (payload: MatchSnapshot) => void;
  'match:event': (payload: {
    matchId: string;
    sequence: number;
    event: Record<string, unknown>;
  }) => void;
  'match:error': (payload: SocketError) => void;
  'match:finished': (payload: { matchId: string; result: 'win' | 'loss' | 'draw' }) => void;
}

export interface QueueJoinPayload {
  format: string;
  deckId: string;
}

export interface QueueLeavePayload {
  format: string;
}

export interface MatchReadyPayload {
  matchId: string;
}

export interface MatchReferencePayload {
  matchId: string;
}

export interface MatchResyncPayload extends MatchReferencePayload {
  lastSequence: number;
}

export interface SocketError {
  code: string;
  message: string;
  event?: string;
}

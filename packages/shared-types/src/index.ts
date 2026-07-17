export type UserRole = 'user' | 'moderator' | 'admin';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  bio: string | null;
  role: UserRole;
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
}

export interface CardDetail extends CardSummary {
  description: string | null;
  effectText: string | null;
  stats: Record<string, unknown>;
  effects: CardEffectDefinition[];
  metadata: Record<string, unknown>;
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
  cardCount?: number;
}

export interface CollectionEntry {
  cardVariantId: string;
  quantity: number;
  lockedQuantity: number;
  firstObtainedAt: string;
  lastObtainedAt: string;
  variant?: {
    id: string;
    name: string;
    card: CardSummary;
  };
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

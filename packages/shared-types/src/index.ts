export type AppRole = 'USER' | 'PIONEER' | 'MODERATOR' | 'ADMINISTRATOR';
export type UserRole = AppRole;
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export const ROLE_LABELS: Record<AppRole, string> = {
  USER: 'Utilisateur',
  PIONEER: 'Pionnier',
  MODERATOR: 'Modérateur',
  ADMINISTRATOR: 'Administrateur',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  BANNED: 'Banni',
};

export type AppPermission =
  | 'ADMIN_ACCESS'
  | 'USERS_READ'
  | 'USERS_UPDATE_PROFILE'
  | 'USERS_UPDATE_EMAIL'
  | 'USERS_SEND_PASSWORD_RESET'
  | 'USERS_SET_TEMPORARY_PASSWORD'
  | 'USERS_WARN'
  | 'USERS_SUSPEND'
  | 'USERS_BAN'
  | 'USERS_MODERATE'
  | 'USERS_CHANGE_ROLE'
  | 'USERS_VIEW_MODERATION_HISTORY'
  | 'USERS_VIEW_SECURITY'
  | 'USERS_DELETE'
  | 'CARDS_READ_ADMIN'
  | 'CARDS_CREATE'
  | 'CARDS_UPDATE'
  | 'CARDS_ARCHIVE'
  | 'CATALOG_CREATE'
  | 'CATALOG_UPDATE'
  | 'CATALOG_ARCHIVE'
  | 'CATALOG_RESTORE'
  | 'CATALOG_DELETE_PERMANENTLY'
  | 'CARDS_RESTORE'
  | 'CARDS_DELETE_PERMANENTLY'
  | 'AUDIT_LOGS_READ';

const moderatorPermissions = [
  'ADMIN_ACCESS',
  'USERS_READ',
  'USERS_UPDATE_PROFILE',
  'USERS_SEND_PASSWORD_RESET',
  'USERS_WARN',
  'USERS_SUSPEND',
  'USERS_BAN',
  'USERS_MODERATE',
  'USERS_VIEW_MODERATION_HISTORY',
  'USERS_VIEW_SECURITY',
  'CARDS_READ_ADMIN',
  'CARDS_CREATE',
  'CARDS_UPDATE',
  'CARDS_ARCHIVE',
  'CATALOG_CREATE',
  'CATALOG_UPDATE',
  'CATALOG_ARCHIVE',
] as const satisfies readonly AppPermission[];

const administratorPermissions = [
  ...moderatorPermissions,
  'USERS_UPDATE_EMAIL',
  'USERS_SET_TEMPORARY_PASSWORD',
  'USERS_CHANGE_ROLE',
  'USERS_DELETE',
  'CATALOG_RESTORE',
  'CATALOG_DELETE_PERMANENTLY',
  'CARDS_RESTORE',
  'CARDS_DELETE_PERMANENTLY',
  'AUDIT_LOGS_READ',
] as const satisfies readonly AppPermission[];

export const ROLE_PERMISSIONS: Readonly<Record<AppRole, ReadonlySet<AppPermission>>> = {
  USER: new Set(),
  PIONEER: new Set(),
  MODERATOR: new Set(moderatorPermissions),
  ADMINISTRATOR: new Set(administratorPermissions),
};

export function hasPermission(role: AppRole, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

const selfRestrictedPermissions = new Set<AppPermission>([
  'USERS_WARN',
  'USERS_SUSPEND',
  'USERS_BAN',
  'USERS_SET_TEMPORARY_PASSWORD',
]);

export function canManageUserTarget(
  actor: { id: string; role: AppRole },
  target: { id: string; role: AppRole },
  permission: AppPermission,
): boolean {
  if (!hasPermission(actor.role, permission)) return false;
  if (selfRestrictedPermissions.has(permission) && actor.id === target.id) return false;
  if (actor.role === 'MODERATOR') {
    return actor.id !== target.id && (target.role === 'USER' || target.role === 'PIONEER');
  }
  return true;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: AppRole;
  createdAt?: string;
}

export interface UserProfile extends PublicUser {
  normalizedUsername: string;
  email: string;
  roleLabel: string;
  status: AccountStatus;
  statusLabel: string;
  suspendedUntil: string | null;
  updatedAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export type AdminUserListItem = UserProfile;

export type ModerationActionType =
  | 'USER_SUSPENDED'
  | 'USER_UNSUSPENDED'
  | 'USER_BANNED'
  | 'USER_UNBANNED'
  | 'ROLE_CHANGED'
  | 'PIONEER_GRANTED'
  | 'PIONEER_REVOKED';

export interface ModerationAction {
  id: string;
  targetUserId: string;
  actorUserId: string | null;
  action: ModerationActionType;
  previousStatus: AccountStatus | null;
  newStatus: AccountStatus | null;
  previousRole: AppRole | null;
  newRole: AppRole | null;
  reason: string;
  internalNote: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor?: Pick<PublicUser, 'id' | 'username' | 'displayName'> | null;
}

export interface AdminUserDetails extends UserProfile {
  activeWarningsCount: number;
  totalWarningsCount: number;
  latestModerationActions: ModerationAction[];
}

export type WarningSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export const WARNING_SEVERITY_LABELS: Record<WarningSeverity, string> = {
  LOW: 'Faible',
  MEDIUM: 'Modéré',
  HIGH: 'Important',
};

export interface UserWarning {
  id: string;
  userId: string;
  issuedByUserId: string | null;
  reason: string;
  internalNote: string | null;
  severity: WarningSeverity;
  severityLabel: string;
  isActive: boolean;
  acknowledgedAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  issuedBy?: Pick<PublicUser, 'id' | 'username' | 'displayName'> | null;
  revokedBy?: Pick<PublicUser, 'id' | 'username' | 'displayName'> | null;
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

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
}

export type ApiErrorBody = ApiError | { error: ApiError };

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

export interface CardRarity {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayColor: string | null;
  sortOrder: number;
  isActive: boolean;
  cardCount?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CardSeason {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sortOrder: number;
  cardCount?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CardType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayColor: string | null;
  sortOrder: number;
  isActive: boolean;
  cardCount?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Card {
  id: string;
  name: string;
  number: number;
  attack: number;
  defense: number;
  value: number;
  description: string | null;
  imageUrl: string | null;
  isCommander: boolean;
  rarity: Pick<CardRarity, 'id' | 'name' | 'slug' | 'displayColor'>;
  season: Pick<CardSeason, 'id' | 'name' | 'slug' | 'code'>;
  types: Array<Pick<CardType, 'id' | 'name' | 'slug' | 'displayColor'>>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardSummary extends Card {
  setId: string | null;
  slug: string;
  collectionNumber: string;
  cardType: string;
  cost: number | null;
  artworkPath: string | null;
  status: PublicationStatus;
  set?: Pick<CardSetSummary, 'id' | 'name' | 'slug' | 'code'>;
}

export interface CardDetail extends CardSummary {
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
  seasons: CardSeason[];
  rarities: CardRarity[];
  types: CardType[];
}

export interface AdminCard extends CardSummary {
  deletedAt: string | null;
}

export interface CreateCardInput {
  name: string;
  number: number;
  attack: number;
  defense: number;
  value: number;
  description?: string | null;
  imageUrl?: string | null;
  isCommander: boolean;
  rarityId: string;
  seasonId: string;
  typeIds: string[];
  isActive: boolean;
}

export type UpdateCardInput = Partial<CreateCardInput>;

export interface CreateRarityInput {
  name: string;
  slug: string;
  description?: string | null;
  displayColor?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type UpdateRarityInput = Partial<CreateRarityInput>;

export interface CreateSeasonInput {
  name: string;
  slug: string;
  code?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type UpdateSeasonInput = Partial<CreateSeasonInput>;

export type CreateCardTypeInput = CreateRarityInput;
export type UpdateCardTypeInput = Partial<CreateCardTypeInput>;

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

export interface AdminAuditLog {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: string;
  actor?: Pick<PublicUser, 'id' | 'username' | 'displayName'> | null;
}

export interface AdminOverview {
  status: 'ready';
  counts: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    bannedUsers: number;
    pioneers: number;
    cards: number;
    rarities: number;
    seasons: number;
    types: number;
  };
  recentActions: AdminAuditLog[];
  generatedAt: string;
}

export interface UsernameAvailability {
  username: string;
  normalizedUsername: string;
  available: boolean;
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

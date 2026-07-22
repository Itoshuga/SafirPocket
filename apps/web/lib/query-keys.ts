const collectionRoot = ['collection'] as const;
const cardsRoot = ['cards'] as const;
const profileRoot = ['profile'] as const;
const profileStatsRoot = [...profileRoot, 'stats'] as const;

export const profileQueryKeys = {
  root: profileRoot,
  me: () => [...profileRoot, 'me'] as const,
  stats: {
    root: profileStatsRoot,
    me: () => [...profileStatsRoot, 'me'] as const,
    public: (username: string) =>
      [...profileStatsRoot, 'public', username.toLocaleLowerCase('fr')] as const,
  },
  summary: () => [...profileRoot, 'me', 'summary'] as const,
  public: (username: string) =>
    [...profileRoot, 'public', username.toLocaleLowerCase('fr')] as const,
  collection: (username: string, filters: string) =>
    [...profileRoot, 'public', username.toLocaleLowerCase('fr'), 'collection', filters] as const,
  seasonCollections: (username: string) =>
    [...profileRoot, username.toLocaleLowerCase('fr'), 'collection', 'seasons'] as const,
  seasonCollection: (username: string, seasonSlug: string, filters: string) =>
    [
      ...profileRoot,
      username.toLocaleLowerCase('fr'),
      'collection',
      'seasons',
      seasonSlug,
      filters,
    ] as const,
} as const;

export const queryKeys = {
  cardsRoot,
  cards: (filters: string) => [...cardsRoot, 'list', filters] as const,
  card: (id: string) => ['card', id] as const,
  cardFacets: ['card-facets'] as const,
  collections: collectionRoot,
  collection: (filters: string) => [...collectionRoot, 'list', filters] as const,
  cardCollectionContext: (id: string) => ['card-collection-context', id] as const,
  decks: ['decks'] as const,
  deck: (id: string) => ['deck', id] as const,
  boosterProducts: ['booster-products'] as const,
  boosterOpenings: (filters = 'page=1&pageSize=12') => ['booster-openings', filters] as const,
  boosterOpening: (id: string) => ['booster-opening', id] as const,
  boosterDropRates: (id: string) => ['booster-drop-rates', id] as const,
  wallets: ['wallets'] as const,
  profileRoot,
  profile: profileQueryKeys.me(),
  profileStats: profileQueryKeys.stats.me(),
  profileSummary: profileQueryKeys.summary(),
  preferences: ['preferences'] as const,
  publicProfile: profileQueryKeys.public,
  publicProfileStats: profileQueryKeys.stats.public,
  publicProfileCollection: profileQueryKeys.collection,
  profileSeasonCollections: profileQueryKeys.seasonCollections,
  profileSeasonCollection: profileQueryKeys.seasonCollection,
  userSearch: (filters: string) => ['user-search', filters] as const,
  friends: ['friends'] as const,
  friendRequestsReceived: ['friend-requests', 'received'] as const,
  friendRequestsSent: ['friend-requests', 'sent'] as const,
  blockedUsers: ['blocked-users'] as const,
  accountSecurity: ['account-security'] as const,
  rankings: (filters: string) => ['rankings', filters] as const,
  myRanking: ['my-ranking'] as const,
  adminOverview: ['admin', 'overview'] as const,
  adminUsers: (filters: string) => ['admin', 'users', filters] as const,
  adminUser: (id: string) => ['admin', 'user', id] as const,
  adminModerationHistory: (id: string) => ['admin', 'user', id, 'moderation'] as const,
  adminUserWarnings: (id: string, status = 'all') =>
    ['admin', 'user', id, 'warnings', status] as const,
  adminUserAuditLogs: (id: string) => ['admin', 'user', id, 'audit-logs'] as const,
  adminCardsRoot: ['admin', 'cards'] as const,
  adminCards: (filters: string) => ['admin', 'cards', filters] as const,
  adminCard: (id: string) => ['admin', 'card', id] as const,
  adminCardExportEstimate: (options: string) =>
    ['admin', 'cards', 'export-estimate', options] as const,
  adminCardDataOperations: (filters: string) =>
    ['admin', 'cards', 'data-operations', filters] as const,
  adminBoosters: (filters: string) => ['admin', 'boosters', filters] as const,
  adminBooster: (id: string) => ['admin', 'booster', id] as const,
  adminRaritiesRoot: ['admin', 'rarities'] as const,
  adminRarities: (filters = 'active') => ['admin', 'rarities', filters] as const,
  adminSeasonsRoot: ['admin', 'seasons'] as const,
  adminSeasons: (filters = 'active') => ['admin', 'seasons', filters] as const,
  adminCardTypesRoot: ['admin', 'card-types'] as const,
  adminCardTypes: (filters = 'active') => ['admin', 'card-types', filters] as const,
  adminAuditLogs: (filters: string) => ['admin', 'audit-logs', filters] as const,
} as const;

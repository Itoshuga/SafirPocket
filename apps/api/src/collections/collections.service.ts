import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PROFILE_SEASON_PREVIEW_CARD_LIMIT } from '@safir/shared-types';
import type {
  ProfileCollectionItem,
  ProfileSeasonCollectionSummary,
  SeasonCollectionCardItem,
  SeasonCollectionDetails,
} from '@safir/shared-types';
import type { CollectionFilters, SeasonCollectionFilters } from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import { cardRelations, toCard } from '../cards/card.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfileAccessPolicyService } from '../users/profile-access-policy.service.js';

const seasonCardInclude = {
  ...cardRelations,
  variants: {
    include: { userCards: true },
    orderBy: [{ displayOrder: 'asc' as const }, { name: 'asc' as const }],
  },
} satisfies Prisma.CardInclude;

type SeasonCardWithRelations = Prisma.CardGetPayload<{ include: typeof seasonCardInclude }>;

const seasonPreviewCardInclude = (userId: string) =>
  ({
    ...cardRelations,
    variants: {
      where: { userCards: { some: { userId, quantity: { gt: 0 } } } },
      select: {
        id: true,
        name: true,
        finish: true,
        artworkPath: true,
        displayOrder: true,
        userCards: {
          where: { userId, quantity: { gt: 0 } },
          select: { quantity: true, lockedQuantity: true, lastObtainedAt: true },
        },
      },
      orderBy: [{ displayOrder: 'asc' as const }, { name: 'asc' as const }],
    },
  }) satisfies Prisma.CardInclude;

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: ProfileAccessPolicyService,
  ) {}

  async list(userId: string, filters: CollectionFilters) {
    const { rows, pagination } = await this.queryPage(userId, filters, true);
    return {
      data: rows.map(({ cardVariant, ...row }) => ({
        ...row,
        variant: { ...cardVariant, card: toCard(cardVariant.card) },
      })),
      pagination,
    };
  }

  async publicList(username: string, viewerId: string | undefined, filters: CollectionFilters) {
    const { profile, preferences, permissions } = await this.accessPolicy.resolve(
      username,
      viewerId,
    );
    if (!permissions.canViewCollection) {
      const friendsOnly = preferences.collectionVisibility === 'FRIENDS';
      throw new ForbiddenException({
        code: friendsOnly ? 'COLLECTION_FRIENDS_ONLY' : 'COLLECTION_PRIVATE',
        message: friendsOnly
          ? 'Cette collection est visible uniquement par les amis de cet utilisateur.'
          : 'La collection de cet utilisateur est privée.',
      });
    }
    const { rows, pagination } = await this.queryPage(
      profile.id,
      filters,
      permissions.canViewQuantities,
    );
    return {
      data: rows.map<ProfileCollectionItem>(({ cardVariant, quantity }) => ({
        cardVariantId: cardVariant.id,
        ...(permissions.canViewQuantities ? { quantity } : {}),
        variant: { ...cardVariant, card: toCard(cardVariant.card) },
      })),
      pagination,
    };
  }

  async seasonSummaries(userId: string) {
    return this.buildSeasonSummaries(userId, {
      includeEmpty: true,
      canViewQuantities: true,
      canViewCompletion: true,
      includePrivateOwnership: true,
    });
  }

  async publicSeasonSummaries(username: string, viewerId?: string) {
    const access = await this.resolvePublicCollection(username, viewerId);
    return this.buildSeasonSummaries(access.profile.id, {
      includeEmpty: false,
      canViewQuantities: access.permissions.canViewQuantities,
      canViewCompletion: access.permissions.canViewCollectionCompletion,
      includePrivateOwnership: false,
    });
  }

  async seasonDetails(userId: string, seasonSlug: string, filters: SeasonCollectionFilters) {
    return this.querySeasonDetails(userId, seasonSlug, filters, {
      publicOnlyOwned: false,
      canViewQuantities: true,
      canViewCompletion: true,
      includePrivateOwnership: true,
    });
  }

  async publicSeasonDetails(
    username: string,
    viewerId: string | undefined,
    seasonSlug: string,
    filters: SeasonCollectionFilters,
  ) {
    const access = await this.resolvePublicCollection(username, viewerId);
    return this.querySeasonDetails(access.profile.id, seasonSlug, filters, {
      publicOnlyOwned: true,
      canViewQuantities: access.permissions.canViewQuantities,
      canViewCompletion: access.permissions.canViewCollectionCompletion,
      includePrivateOwnership: false,
    });
  }

  private async buildSeasonSummaries(
    userId: string,
    options: {
      includeEmpty: boolean;
      canViewQuantities: boolean;
      canViewCompletion: boolean;
      includePrivateOwnership: boolean;
    },
  ): Promise<ProfileSeasonCollectionSummary[]> {
    const ownedCardsWhere = {
      status: 'published' as const,
      isActive: true,
      deletedAt: null,
      variants: { some: { userCards: { some: { userId, quantity: { gt: 0 } } } } },
    } satisfies Prisma.CardWhereInput;
    const [seasons, ownershipRows] = await Promise.all([
      this.prisma.cardSeason.findMany({
        where: { isActive: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          sortOrder: true,
          _count: {
            select: {
              cards: { where: { status: 'published', isActive: true, deletedAt: null } },
            },
          },
          boosters: {
            where: { status: 'published', isActive: true, deletedAt: null },
            select: { imageUrl: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            take: 1,
          },
          cards: {
            where: ownedCardsWhere,
            include: seasonPreviewCardInclude(userId),
            orderBy: [{ rarity: { sortOrder: 'desc' } }, { number: 'asc' }, { id: 'asc' }],
            take: PROFILE_SEASON_PREVIEW_CARD_LIMIT,
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.userCard.findMany({
        where: {
          userId,
          quantity: { gt: 0 },
          cardVariant: {
            card: {
              status: 'published',
              isActive: true,
              deletedAt: null,
              season: { isActive: true, deletedAt: null },
            },
          },
        },
        select: {
          quantity: true,
          cardVariant: {
            select: {
              cardId: true,
              card: { select: { seasonId: true } },
            },
          },
        },
      }),
    ]);

    const ownershipBySeason = new Map<string, { cardIds: Set<string>; totalCopies: number }>();
    for (const row of ownershipRows) {
      const seasonId = row.cardVariant.card.seasonId;
      const ownership = ownershipBySeason.get(seasonId) ?? {
        cardIds: new Set<string>(),
        totalCopies: 0,
      };
      ownership.cardIds.add(row.cardVariant.cardId);
      ownership.totalCopies += row.quantity;
      ownershipBySeason.set(seasonId, ownership);
    }

    return seasons.flatMap((season) => {
      const ownership = ownershipBySeason.get(season.id);
      const uniqueOwnedCards = ownership?.cardIds.size ?? 0;
      if (!options.includeEmpty && uniqueOwnedCards === 0) return [];
      const totalCopies = options.canViewQuantities ? (ownership?.totalCopies ?? 0) : undefined;
      const completion = season._count.cards
        ? Math.round((uniqueOwnedCards / season._count.cards) * 1000) / 10
        : 0;
      const previewCards = season.cards
        .slice(0, PROFILE_SEASON_PREVIEW_CARD_LIMIT)
        .map<SeasonCollectionCardItem>((card) => {
          const ownedVariants = card.variants.flatMap((variant) => {
            const variantOwnership = variant.userCards[0];
            if (!variantOwnership) return [];
            return [
              {
                cardVariantId: variant.id,
                name: variant.name,
                finish: variant.finish,
                artworkPath: variant.artworkPath,
                ...(options.canViewQuantities ? { quantity: variantOwnership.quantity } : {}),
                ...(options.includePrivateOwnership
                  ? {
                      lockedQuantity: variantOwnership.lockedQuantity,
                      lastObtainedAt: variantOwnership.lastObtainedAt.toISOString(),
                    }
                  : {}),
              },
            ];
          });
          const previewQuantity = ownedVariants.reduce(
            (sum, variant) => sum + (variant.quantity ?? 0),
            0,
          );
          const previewLockedQuantity = ownedVariants.reduce(
            (sum, variant) => sum + (variant.lockedQuantity ?? 0),
            0,
          );
          return {
            card: toCard(card),
            owned: true,
            ...(options.canViewQuantities ? { quantity: previewQuantity } : {}),
            ...(options.includePrivateOwnership ? { lockedQuantity: previewLockedQuantity } : {}),
            ownedVariants,
          };
        });
      return [
        {
          season: {
            id: season.id,
            name: season.name,
            slug: season.slug,
            code: season.code,
            imageUrl: season.boosters[0]?.imageUrl ?? null,
            sortOrder: season.sortOrder,
          },
          collection: {
            uniqueOwnedCards,
            ...(options.canViewCompletion
              ? {
                  totalAvailableCards: season._count.cards,
                  completionPercentage: completion,
                }
              : {}),
            ...(totalCopies !== undefined ? { totalCopies } : {}),
          },
          previewCards,
        },
      ];
    });
  }

  private async querySeasonDetails(
    userId: string,
    seasonSlug: string,
    filters: SeasonCollectionFilters,
    options: {
      publicOnlyOwned: boolean;
      canViewQuantities: boolean;
      canViewCompletion: boolean;
      includePrivateOwnership: boolean;
    },
  ): Promise<SeasonCollectionDetails> {
    const season = await this.prisma.cardSeason.findFirst({
      where: { slug: seasonSlug, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        sortOrder: true,
        _count: {
          select: {
            cards: { where: { status: 'published', isActive: true, deletedAt: null } },
          },
        },
        boosters: {
          where: { status: 'published', isActive: true, deletedAt: null },
          select: { imageUrl: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          take: 1,
        },
      },
    });
    if (!season) {
      throw new NotFoundException({
        code: 'COLLECTION_SEASON_NOT_FOUND',
        message: 'Cette saison est introuvable.',
      });
    }

    const ownedRelation = {
      userCards: { some: { userId, quantity: { gt: 0 } } },
    };
    const where: Prisma.CardWhereInput = {
      seasonId: season.id,
      status: 'published',
      isActive: true,
      deletedAt: null,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { description: { contains: filters.search, mode: 'insensitive' as const } },
              { effectText: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(filters.rarity ? { rarity: { slug: filters.rarity } } : {}),
      ...(filters.type ? { typeLinks: { some: { type: { slug: filters.type } } } } : {}),
      ...(filters.isCommander === undefined ? {} : { isCommander: filters.isCommander }),
      ...(options.publicOnlyOwned || filters.owned === true
        ? { variants: { some: ownedRelation } }
        : filters.owned === false
          ? { variants: { none: ownedRelation } }
          : {}),
    };
    const orderBy: Prisma.CardOrderByWithRelationInput[] =
      filters.sort === 'name'
        ? [{ name: 'asc' }, { number: 'asc' }]
        : filters.sort === '-name'
          ? [{ name: 'desc' }, { number: 'asc' }]
          : filters.sort === '-number'
            ? [{ number: 'desc' }]
            : filters.sort === 'rarity'
              ? [{ rarity: { sortOrder: 'desc' } }, { number: 'asc' }]
              : [{ number: 'asc' }];
    const needsMemorySort =
      filters.sort === 'recent' || (filters.sort === '-quantity' && options.canViewQuantities);
    const cardsPromise = this.prisma.card.findMany({
      where,
      include: {
        ...seasonCardInclude,
        variants: {
          include: { userCards: { where: { userId, quantity: { gt: 0 } } } },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy,
      ...(needsMemorySort
        ? {}
        : { skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    });
    const [ownership, total, rows] = await Promise.all([
      this.prisma.userCard.findMany({
        where: {
          userId,
          quantity: { gt: 0 },
          cardVariant: {
            card: {
              seasonId: season.id,
              status: 'published',
              isActive: true,
              deletedAt: null,
            },
          },
        },
        select: { quantity: true, cardVariant: { select: { cardId: true } } },
      }),
      this.prisma.card.count({ where }),
      cardsPromise,
    ]);
    let sortableItems = (rows as SeasonCardWithRelations[]).map((card) => ({
      item: toSeasonCollectionCardItem(
        card,
        userId,
        options.canViewQuantities,
        options.includePrivateOwnership,
      ),
      latestObtainedAt: latestObtainedFromCard(card, userId),
    }));
    if (needsMemorySort) {
      sortableItems.sort((left, right) => {
        if (filters.sort === '-quantity') {
          return (
            (right.item.quantity ?? 0) - (left.item.quantity ?? 0) ||
            left.item.card.number - right.item.card.number
          );
        }
        return (
          right.latestObtainedAt - left.latestObtainedAt ||
          left.item.card.number - right.item.card.number
        );
      });
      sortableItems = sortableItems.slice(
        (filters.page - 1) * filters.pageSize,
        filters.page * filters.pageSize,
      );
    }
    const items = sortableItems.map(({ item }) => item);

    const uniqueOwnedCards = new Set(ownership.map(({ cardVariant }) => cardVariant.cardId)).size;
    const totalCopies = ownership.reduce((sum, row) => sum + row.quantity, 0);
    const completion = season._count.cards
      ? Math.round((uniqueOwnedCards / season._count.cards) * 1000) / 10
      : 0;
    return {
      season: {
        id: season.id,
        name: season.name,
        slug: season.slug,
        code: season.code,
        imageUrl: season.boosters[0]?.imageUrl ?? null,
        sortOrder: season.sortOrder,
      },
      collection: {
        uniqueOwnedCards,
        ...(options.canViewCompletion
          ? {
              totalAvailableCards: season._count.cards,
              completionPercentage: completion,
            }
          : {}),
        ...(options.canViewQuantities ? { totalCopies } : {}),
      },
      cards: {
        data: items,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          pageCount: Math.ceil(total / filters.pageSize),
        },
      },
    };
  }

  private async resolvePublicCollection(username: string, viewerId?: string) {
    const access = await this.accessPolicy.resolve(username, viewerId);
    if (!access.permissions.canViewCollection) {
      const friendsOnly = access.preferences.collectionVisibility === 'FRIENDS';
      throw new ForbiddenException({
        code: friendsOnly ? 'COLLECTION_FRIENDS_ONLY' : 'COLLECTION_PRIVATE',
        message: friendsOnly
          ? 'Cette collection est visible uniquement par les amis de cet utilisateur.'
          : 'La collection de cet utilisateur est privée.',
      });
    }
    return access;
  }

  private async queryPage(userId: string, filters: CollectionFilters, allowQuantitySort: boolean) {
    const season = filters.season ?? filters.set;
    const where: Prisma.UserCardWhereInput = {
      userId,
      quantity: { gt: 0 },
      cardVariant: {
        card: {
          status: 'published',
          isActive: true,
          deletedAt: null,
          ...(filters.search
            ? {
                OR: [
                  { name: { contains: filters.search, mode: 'insensitive' as const } },
                  { description: { contains: filters.search, mode: 'insensitive' as const } },
                  { effectText: { contains: filters.search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
          ...(season ? { season: { slug: season } } : {}),
          ...(filters.rarity ? { rarity: { slug: filters.rarity } } : {}),
          ...(filters.type ? { typeLinks: { some: { type: { slug: filters.type } } } } : {}),
          ...(filters.isCommander === undefined ? {} : { isCommander: filters.isCommander }),
        },
      },
    };
    const orderBy: Prisma.UserCardOrderByWithRelationInput[] =
      filters.sort === 'name'
        ? [{ cardVariant: { card: { name: 'asc' } } }, { lastObtainedAt: 'desc' }]
        : filters.sort === '-name'
          ? [{ cardVariant: { card: { name: 'desc' } } }, { lastObtainedAt: 'desc' }]
          : filters.sort === 'number'
            ? [{ cardVariant: { card: { number: 'asc' } } }, { lastObtainedAt: 'desc' }]
            : filters.sort === '-number'
              ? [{ cardVariant: { card: { number: 'desc' } } }, { lastObtainedAt: 'desc' }]
              : filters.sort === 'rarity'
                ? [
                    { cardVariant: { card: { rarity: { sortOrder: 'asc' } } } },
                    { lastObtainedAt: 'desc' },
                  ]
                : filters.sort === 'season'
                  ? [
                      { cardVariant: { card: { season: { sortOrder: 'asc' } } } },
                      { lastObtainedAt: 'desc' },
                    ]
                  : filters.sort === '-quantity' && allowQuantitySort
                    ? [{ quantity: 'desc' }, { lastObtainedAt: 'desc' }]
                    : filters.sort === '-quantity'
                      ? [{ cardVariant: { card: { number: 'asc' } } }, { lastObtainedAt: 'desc' }]
                      : [{ lastObtainedAt: 'desc' }];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userCard.findMany({
        where,
        include: {
          cardVariant: {
            include: { card: { include: cardRelations } },
          },
        },
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.userCard.count({ where }),
    ]);
    return {
      rows,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        pageCount: Math.ceil(total / filters.pageSize),
      },
    };
  }

  async summary(userId: string) {
    const [owned, publishedSets] = await Promise.all([
      this.prisma.userCard.findMany({
        where: {
          userId,
          cardVariant: { card: { status: 'published', isActive: true, deletedAt: null } },
        },
        select: {
          quantity: true,
          cardVariant: {
            select: { cardId: true, card: { select: { legacyRarity: true, setId: true } } },
          },
        },
      }),
      this.prisma.cardSet.findMany({
        where: { status: 'published' },
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          _count: {
            select: {
              cards: { where: { status: 'published', isActive: true, deletedAt: null } },
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);
    const publishedCardCount = publishedSets.reduce((sum, set) => sum + set._count.cards, 0);
    const uniqueCards = new Set(owned.map(({ cardVariant }) => cardVariant.cardId)).size;
    const rarityCounts = new Map<string, number>();
    for (const entry of owned) {
      const rarity = entry.cardVariant.card.legacyRarity;
      rarityCounts.set(rarity, (rarityCounts.get(rarity) ?? 0) + entry.quantity);
    }
    const favoriteRarity = [...rarityCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const ownedBySet = new Map<string, Set<string>>();
    for (const entry of owned) {
      const setId = entry.cardVariant.card.setId;
      if (!setId) continue;
      const cardIds = ownedBySet.get(setId) ?? new Set<string>();
      cardIds.add(entry.cardVariant.cardId);
      ownedBySet.set(setId, cardIds);
    }
    return {
      totalCopies: owned.reduce((sum, entry) => sum + entry.quantity, 0),
      uniqueVariants: owned.length,
      uniqueCards,
      publishedCardCount,
      completionRate: publishedCardCount
        ? Math.round((uniqueCards / publishedCardCount) * 1000) / 10
        : 0,
      favoriteRarity,
      sets: publishedSets.map(({ _count, ...set }) => {
        const ownedCards = ownedBySet.get(set.id)?.size ?? 0;
        return {
          ...set,
          ownedCards,
          cardCount: _count.cards,
          missingCards: Math.max(0, _count.cards - ownedCards),
          completionRate: _count.cards ? Math.round((ownedCards / _count.cards) * 1000) / 10 : 0,
        };
      }),
    };
  }

  async cardContext(userId: string, cardId: string) {
    const [rows, deckCards] = await Promise.all([
      this.prisma.userCard.findMany({
        where: { userId, cardVariant: { cardId } },
        select: {
          cardVariantId: true,
          quantity: true,
          lockedQuantity: true,
          cardVariant: { select: { name: true } },
        },
        orderBy: { cardVariant: { displayOrder: 'asc' } },
      }),
      this.prisma.deckCard.findMany({
        where: { deck: { ownerId: userId }, cardVariant: { cardId } },
        select: {
          quantity: true,
          deck: { select: { id: true, name: true } },
          cardVariant: { select: { name: true } },
        },
        orderBy: { deck: { name: 'asc' } },
      }),
    ]);
    return {
      totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      lockedQuantity: rows.reduce((sum, row) => sum + row.lockedQuantity, 0),
      variants: rows.map(({ cardVariant, ...row }) => ({
        ...row,
        variantName: cardVariant.name,
      })),
      decks: deckCards.map(({ deck, cardVariant, quantity }) => ({
        ...deck,
        quantity,
        variantName: cardVariant.name,
      })),
    };
  }
}

function toSeasonCollectionCardItem(
  card: SeasonCardWithRelations,
  userId: string,
  canViewQuantities: boolean,
  includePrivateOwnership: boolean,
): SeasonCollectionCardItem {
  const ownedVariants = card.variants.flatMap((variant) => {
    const ownership = variant.userCards.find((row) => row.userId === userId && row.quantity > 0);
    if (!ownership) return [];
    return [
      {
        cardVariantId: variant.id,
        name: variant.name,
        finish: variant.finish,
        artworkPath: variant.artworkPath,
        ...(canViewQuantities ? { quantity: ownership.quantity } : {}),
        ...(includePrivateOwnership
          ? {
              lockedQuantity: ownership.lockedQuantity,
              lastObtainedAt: ownership.lastObtainedAt.toISOString(),
            }
          : {}),
      },
    ];
  });
  const quantity = canViewQuantities
    ? ownedVariants.reduce((sum, variant) => sum + (variant.quantity ?? 0), 0)
    : undefined;
  const lockedQuantity = canViewQuantities
    ? ownedVariants.reduce((sum, variant) => sum + (variant.lockedQuantity ?? 0), 0)
    : undefined;
  return {
    card: toCard(card),
    owned: ownedVariants.length > 0,
    ...(quantity !== undefined ? { quantity } : {}),
    ...(includePrivateOwnership ? { lockedQuantity } : {}),
    ownedVariants,
  };
}

function latestObtainedFromCard(card: SeasonCardWithRelations, userId: string): number {
  return Math.max(
    0,
    ...card.variants.flatMap((variant) =>
      variant.userCards
        .filter((row) => row.userId === userId && row.quantity > 0)
        .map((row) => row.lastObtainedAt.getTime()),
    ),
  );
}

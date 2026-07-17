import { Injectable } from '@nestjs/common';
import type { CollectionFilters } from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: CollectionFilters) {
    const where: Prisma.UserCardWhereInput = {
      userId,
      cardVariant: {
        card: {
          status: 'published',
          ...(filters.search
            ? { name: { contains: filters.search, mode: 'insensitive' as const } }
            : {}),
          ...(filters.set ? { set: { slug: filters.set } } : {}),
          ...(filters.rarity ? { rarity: filters.rarity } : {}),
        },
      },
    };
    const orderBy: Prisma.UserCardOrderByWithRelationInput =
      filters.sort === 'name'
        ? { cardVariant: { card: { name: 'asc' } } }
        : filters.sort === '-quantity'
          ? { quantity: 'desc' }
          : { lastObtainedAt: 'desc' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userCard.findMany({
        where,
        select: {
          cardVariantId: true,
          quantity: true,
          lockedQuantity: true,
          firstObtainedAt: true,
          lastObtainedAt: true,
          cardVariant: {
            select: {
              id: true,
              name: true,
              finish: true,
              artworkPath: true,
              card: {
                select: {
                  id: true,
                  setId: true,
                  name: true,
                  slug: true,
                  collectionNumber: true,
                  rarity: true,
                  cardType: true,
                  cost: true,
                  artworkPath: true,
                  status: true,
                  set: { select: { id: true, name: true, slug: true, code: true } },
                },
              },
            },
          },
        },
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.userCard.count({ where }),
    ]);
    return {
      data: rows.map(({ cardVariant, ...row }) => ({ ...row, variant: cardVariant })),
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
        where: { userId, cardVariant: { card: { status: 'published' } } },
        select: {
          quantity: true,
          cardVariant: {
            select: { cardId: true, card: { select: { rarity: true, setId: true } } },
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
          _count: { select: { cards: { where: { status: 'published' } } } },
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);
    const publishedCardCount = publishedSets.reduce((sum, set) => sum + set._count.cards, 0);
    const uniqueCards = new Set(owned.map(({ cardVariant }) => cardVariant.cardId)).size;
    const rarityCounts = new Map<string, number>();
    for (const entry of owned) {
      const rarity = entry.cardVariant.card.rarity;
      rarityCounts.set(rarity, (rarityCounts.get(rarity) ?? 0) + entry.quantity);
    }
    const favoriteRarity = [...rarityCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const ownedBySet = new Map<string, Set<string>>();
    for (const entry of owned) {
      const setId = entry.cardVariant.card.setId;
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

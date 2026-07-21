import { Injectable, NotFoundException } from '@nestjs/common';
import type { CardFilters } from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cardRelations, toCard, toCardType, toRarity, toSeason } from './card.mapper.js';

const publicCardWhere = {
  status: 'published',
  isActive: true,
  deletedAt: null,
} satisfies Prisma.CardWhereInput;

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSets() {
    const sets = await this.prisma.cardSet.findMany({
      where: { status: 'published' },
      orderBy: [{ displayOrder: 'asc' }, { releaseDate: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        code: true,
        releaseDate: true,
        _count: { select: { cards: { where: publicCardWhere } } },
      },
    });
    return sets.map(({ _count, ...set }) => ({ ...set, cardCount: _count.cards }));
  }

  async facets() {
    const [sets, seasons, rarities, types] = await Promise.all([
      this.listSets(),
      this.prisma.cardSeason.findMany({
        where: { isActive: true, deletedAt: null },
        include: { _count: { select: { cards: { where: publicCardWhere } } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.cardRarity.findMany({
        where: { isActive: true, deletedAt: null },
        include: { _count: { select: { cards: { where: publicCardWhere } } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.cardType.findMany({
        where: { isActive: true, deletedAt: null },
        include: {
          _count: { select: { links: { where: { card: publicCardWhere } } } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return {
      sets,
      seasons: seasons.map(toSeason),
      rarities: rarities.map(toRarity),
      types: types.map(toCardType),
    };
  }

  async getSet(slug: string) {
    const set = await this.prisma.cardSet.findFirst({
      where: { slug, status: 'published' },
      include: {
        cards: {
          where: publicCardWhere,
          include: cardRelations,
          orderBy: [{ displayOrder: 'asc' }, { number: 'asc' }],
        },
      },
    });
    if (!set) {
      throw new NotFoundException({
        code: 'CARD_SET_NOT_FOUND',
        message: 'Extension introuvable.',
      });
    }
    return { ...set, cards: set.cards.map(toCard) };
  }

  async listCards(filters: CardFilters) {
    const conditions: Prisma.CardWhereInput[] = [];
    if (filters.search) {
      conditions.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { effectText: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }
    const season = filters.season ?? filters.set;
    if (season) {
      conditions.push({ season: { slug: season } });
    }
    const where: Prisma.CardWhereInput = {
      ...publicCardWhere,
      AND: conditions,
      ...(filters.rarity ? { rarity: { slug: filters.rarity } } : {}),
      ...(filters.type ? { typeLinks: { some: { type: { slug: filters.type } } } } : {}),
      ...(filters.isCommander === undefined ? {} : { isCommander: filters.isCommander }),
    };
    const orderBy: Prisma.CardOrderByWithRelationInput[] =
      filters.sort === 'name'
        ? [{ name: 'asc' }, { number: 'asc' }]
        : filters.sort === '-name'
          ? [{ name: 'desc' }, { number: 'asc' }]
          : filters.sort === '-number'
            ? [{ number: 'desc' }, { name: 'asc' }]
            : filters.sort === 'rarity'
              ? [{ rarity: { sortOrder: 'asc' } }, { number: 'asc' }]
              : filters.sort === 'season'
                ? [{ season: { sortOrder: 'asc' } }, { number: 'asc' }]
                : filters.sort === '-createdAt'
                  ? [{ createdAt: 'desc' }, { number: 'asc' }]
                  : [{ number: 'asc' }, { name: 'asc' }];
    const [cards, total] = await this.prisma.$transaction([
      this.prisma.card.findMany({
        where,
        include: cardRelations,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.card.count({ where }),
    ]);
    return {
      data: cards.map(toCard),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        pageCount: Math.ceil(total / filters.pageSize),
      },
    };
  }

  async getCard(id: string) {
    const card = await this.prisma.card.findFirst({
      where: { id, ...publicCardWhere },
      include: {
        ...cardRelations,
        variants: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!card) {
      throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'Carte introuvable.' });
    }
    return {
      ...toCard(card),
      effectText: card.effectText,
      effects: card.effects,
      stats: card.stats,
      metadata: card.metadata,
      variants: card.variants,
    };
  }
}

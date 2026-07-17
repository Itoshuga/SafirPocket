import { Injectable, NotFoundException } from '@nestjs/common';
import type { CardFilters } from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const cardSelect = {
  id: true,
  setId: true,
  name: true,
  slug: true,
  description: true,
  collectionNumber: true,
  rarity: true,
  cardType: true,
  cost: true,
  effectText: true,
  effects: true,
  stats: true,
  metadata: true,
  artworkPath: true,
  status: true,
} satisfies Prisma.CardSelect;

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  listSets() {
    return this.prisma.cardSet.findMany({
      where: { status: 'published' },
      orderBy: [{ displayOrder: 'asc' }, { releaseDate: 'desc' }],
      include: { _count: { select: { cards: { where: { status: 'published' } } } } },
    });
  }

  async getSet(slug: string) {
    const set = await this.prisma.cardSet.findFirst({
      where: { slug, status: 'published' },
      include: {
        cards: {
          where: { status: 'published' },
          select: cardSelect,
          orderBy: [{ displayOrder: 'asc' }, { collectionNumber: 'asc' }],
        },
      },
    });
    if (!set)
      throw new NotFoundException({
        code: 'CARD_SET_NOT_FOUND',
        message: 'Extension introuvable.',
      });
    return set;
  }

  async listCards(filters: CardFilters) {
    const where: Prisma.CardWhereInput = {
      status: 'published',
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { effectText: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(filters.set ? { set: { slug: filters.set } } : {}),
      ...(filters.rarity ? { rarity: filters.rarity } : {}),
      ...(filters.type ? { cardType: filters.type } : {}),
    };
    const orderBy: Prisma.CardOrderByWithRelationInput =
      filters.sort === 'name'
        ? { name: 'asc' }
        : filters.sort === '-name'
          ? { name: 'desc' }
          : filters.sort === '-createdAt'
            ? { createdAt: 'desc' }
            : { collectionNumber: 'asc' };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.card.findMany({
        where,
        select: cardSelect,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.card.count({ where }),
    ]);
    return {
      data,
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
      where: { id, status: 'published' },
      select: { ...cardSelect, set: true, variants: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!card)
      throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'Carte introuvable.' });
    return card;
  }
}

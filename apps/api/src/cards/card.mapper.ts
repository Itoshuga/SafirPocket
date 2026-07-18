import type { AdminCard, CardRarity, CardSeason, CardType } from '@safir/shared-types';
import type { Prisma } from '../generated/prisma/client.js';

export const cardRelations = {
  set: { select: { id: true, name: true, slug: true, code: true } },
  rarity: true,
  season: true,
  typeLinks: {
    include: { type: true },
    orderBy: [{ sortOrder: 'asc' as const }, { type: { name: 'asc' as const } }],
  },
} satisfies Prisma.CardInclude;

export type CardWithRelations = Prisma.CardGetPayload<{ include: typeof cardRelations }>;

export function toCard(card: CardWithRelations): AdminCard {
  return {
    id: card.id,
    setId: card.setId,
    name: card.name,
    slug: card.slug,
    number: Number(card.number),
    collectionNumber: card.collectionNumber,
    attack: Number(card.attack),
    defense: Number(card.defense),
    value: Number(card.value),
    description: card.description,
    imageUrl: card.imageUrl,
    artworkPath: card.artworkPath,
    isCommander: card.isCommander,
    rarity: {
      id: card.rarity.id,
      name: card.rarity.name,
      slug: card.rarity.slug,
      displayColor: card.rarity.displayColor,
    },
    season: {
      id: card.season.id,
      name: card.season.name,
      slug: card.season.slug,
      code: card.season.code,
    },
    types: card.typeLinks.map(({ type }) => ({
      id: type.id,
      name: type.name,
      slug: type.slug,
      displayColor: type.displayColor,
    })),
    cardType: card.typeLinks.map(({ type }) => type.name).join(', '),
    cost: card.cost,
    status: card.status,
    set: card.set ?? undefined,
    isActive: card.isActive,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    deletedAt: card.deletedAt?.toISOString() ?? null,
  };
}

export function toRarity(
  rarity: Prisma.CardRarityGetPayload<{ include: { _count: { select: { cards: true } } } }>,
): CardRarity {
  const { _count, ...data } = rarity;
  return {
    ...data,
    cardCount: _count.cards,
    createdAt: rarity.createdAt.toISOString(),
    updatedAt: rarity.updatedAt.toISOString(),
    deletedAt: rarity.deletedAt?.toISOString() ?? null,
  };
}

export function toSeason(
  season: Prisma.CardSeasonGetPayload<{ include: { _count: { select: { cards: true } } } }>,
): CardSeason {
  const { _count, ...data } = season;
  return {
    ...data,
    startDate: season.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: season.endDate?.toISOString().slice(0, 10) ?? null,
    cardCount: _count.cards,
    createdAt: season.createdAt.toISOString(),
    updatedAt: season.updatedAt.toISOString(),
    deletedAt: season.deletedAt?.toISOString() ?? null,
  };
}

export function toCardType(
  type: Prisma.CardTypeGetPayload<{ include: { _count: { select: { links: true } } } }>,
): CardType {
  const { _count, ...data } = type;
  return {
    ...data,
    cardCount: _count.links,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
    deletedAt: type.deletedAt?.toISOString() ?? null,
  };
}

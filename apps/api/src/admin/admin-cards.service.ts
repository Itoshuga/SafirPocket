import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminCardsQuery, CreateCardInput, UpdateCardInput } from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { rethrowPrismaConstraint } from '../common/errors/prisma-error.js';
import { cardRelations, toCard } from '../cards/card.mapper.js';
import { PrismaService, type PrismaTransactionClient } from '../prisma/prisma.service.js';

@Injectable()
export class AdminCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminCardsQuery) {
    const where: Prisma.CardWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.seasonId ? { seasonId: query.seasonId } : {}),
      ...(query.rarityId ? { rarityId: query.rarityId } : {}),
      ...(query.typeId ? { typeLinks: { some: { typeId: query.typeId } } } : {}),
      ...(query.isCommander !== undefined ? { isCommander: query.isCommander } : {}),
      ...(query.status === 'active'
        ? { isActive: true }
        : query.status === 'inactive'
          ? { isActive: false }
          : {}),
      ...(query.archived === 'active'
        ? { deletedAt: null }
        : query.archived === 'archived'
          ? { deletedAt: { not: null } }
          : {}),
    };
    const [cards, total] = await this.prisma.$transaction([
      this.prisma.card.findMany({
        where,
        include: cardRelations,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.card.count({ where }),
    ]);
    return {
      data: cards.map(toCard),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: cardRelations,
    });
    if (!card) this.notFound();
    return toCard(card);
  }

  async create(actor: AuthenticatedUser, input: CreateCardInput, requestId: string) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        const references = await this.references(
          transaction,
          input.rarityId,
          input.seasonId,
          input.typeIds,
        );
        const card = await transaction.card.create({
          data: {
            name: input.name,
            slug: this.cardSlug(input.name, input.number),
            collectionNumber: String(input.number),
            legacyRarity: references.rarity.name,
            legacyCardType: references.types[0]!.name,
            cost: input.value,
            stats: { attack: input.attack, defense: input.defense },
            metadata: { isCommander: input.isCommander },
            artworkPath: input.imageUrl,
            status: input.isActive ? 'published' : 'draft',
            number: BigInt(input.number),
            attack: BigInt(input.attack),
            defense: BigInt(input.defense),
            value: BigInt(input.value),
            description: input.description,
            imageUrl: input.imageUrl,
            isCommander: input.isCommander,
            rarityId: input.rarityId,
            seasonId: input.seasonId,
            isActive: input.isActive,
            typeLinks: {
              create: input.typeIds.map((typeId, sortOrder) => ({ typeId, sortOrder })),
            },
            variants: {
              create: {
                name: 'Standard',
                slug: 'standard',
                finish: 'standard',
                artworkPath: input.imageUrl,
                displayOrder: 0,
              },
            },
          },
          include: cardRelations,
        });
        await this.audit(transaction, actor.id, card.id, 'CARD_CREATED', requestId, null, input);
        return toCard(card);
      });
    } catch (error) {
      this.rethrowCardConstraint(error);
    }
  }

  async update(
    actor: AuthenticatedUser,
    cardId: string,
    input: UpdateCardInput,
    requestId: string,
  ) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        const existing = await transaction.card.findUnique({
          where: { id: cardId },
          include: cardRelations,
        });
        if (!existing) this.notFound();
        const rarityId = input.rarityId ?? existing.rarityId;
        const seasonId = input.seasonId ?? existing.seasonId;
        const typeIds = input.typeIds ?? existing.typeLinks.map(({ typeId }) => typeId);
        const references = await this.references(transaction, rarityId, seasonId, typeIds);
        const number = input.number ?? Number(existing.number);
        const attack = input.attack ?? Number(existing.attack);
        const defense = input.defense ?? Number(existing.defense);
        const value = input.value ?? Number(existing.value);
        const isCommander = input.isCommander ?? existing.isCommander;
        const isActive = input.isActive ?? existing.isActive;
        const name = input.name ?? existing.name;
        if (input.typeIds) {
          await transaction.cardTypeLink.deleteMany({ where: { cardId } });
          await transaction.cardTypeLink.createMany({
            data: input.typeIds.map((typeId, sortOrder) => ({ cardId, typeId, sortOrder })),
          });
        }
        if (input.imageUrl !== undefined) {
          await transaction.cardVariant.updateMany({
            where: { cardId, slug: 'standard' },
            data: { artworkPath: input.imageUrl },
          });
        }
        const card = await transaction.card.update({
          where: { id: cardId },
          data: {
            ...(input.name !== undefined ? { name } : {}),
            ...(input.name !== undefined || input.number !== undefined
              ? { slug: this.cardSlug(name, number) }
              : {}),
            ...(input.number !== undefined
              ? { number: BigInt(number), collectionNumber: String(number) }
              : {}),
            ...(input.attack !== undefined ? { attack: BigInt(attack) } : {}),
            ...(input.defense !== undefined ? { defense: BigInt(defense) } : {}),
            ...(input.value !== undefined ? { value: BigInt(value), cost: value } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.imageUrl !== undefined
              ? { imageUrl: input.imageUrl, artworkPath: input.imageUrl }
              : {}),
            ...(input.isCommander !== undefined ? { isCommander } : {}),
            ...(input.rarityId !== undefined
              ? { rarityId, legacyRarity: references.rarity.name }
              : {}),
            ...(input.seasonId !== undefined ? { seasonId } : {}),
            ...(input.typeIds !== undefined ? { legacyCardType: references.types[0]!.name } : {}),
            ...(input.isActive !== undefined
              ? { isActive, status: isActive ? 'published' : 'draft' }
              : {}),
            stats: { attack, defense },
            metadata: { isCommander },
          },
          include: cardRelations,
        });
        await this.audit(
          transaction,
          actor.id,
          card.id,
          'CARD_UPDATED',
          requestId,
          toCard(existing),
          input,
        );
        return toCard(card);
      });
    } catch (error) {
      this.rethrowCardConstraint(error);
    }
  }

  archive(actor: AuthenticatedUser, cardId: string, requestId: string) {
    return this.setArchived(actor, cardId, true, requestId);
  }

  restore(actor: AuthenticatedUser, cardId: string, requestId: string) {
    return this.setArchived(actor, cardId, false, requestId);
  }

  async permanentlyDelete(actor: AuthenticatedUser, cardId: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const existing = await transaction.card.findUnique({
        where: { id: cardId },
        include: { ...cardRelations, _count: { select: { variants: true } } },
      });
      if (!existing) this.notFound();
      if (existing._count.variants > 0) {
        throw new ConflictException({
          code: 'RESOURCE_STILL_REFERENCED',
          message: 'Cette carte possède encore des variantes et ne peut pas être supprimée.',
          details: { variants: existing._count.variants },
        });
      }
      await transaction.card.delete({ where: { id: cardId } });
      await this.audit(
        transaction,
        actor.id,
        cardId,
        'CARD_DELETED_PERMANENTLY',
        requestId,
        toCard(existing),
        null,
      );
      return { deleted: true, id: cardId };
    });
  }

  private async setArchived(
    actor: AuthenticatedUser,
    cardId: string,
    archived: boolean,
    requestId: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const existing = await transaction.card.findUnique({
        where: { id: cardId },
        include: cardRelations,
      });
      if (!existing) this.notFound();
      const card = await transaction.card.update({
        where: { id: cardId },
        data: archived
          ? { deletedAt: new Date(), isActive: false, status: 'archived' }
          : { deletedAt: null, isActive: true, status: 'published' },
        include: cardRelations,
      });
      await this.audit(
        transaction,
        actor.id,
        card.id,
        archived ? 'CARD_ARCHIVED' : 'CARD_RESTORED',
        requestId,
        toCard(existing),
        toCard(card),
      );
      return toCard(card);
    });
  }

  private async references(
    transaction: PrismaTransactionClient,
    rarityId: string,
    seasonId: string,
    typeIds: string[],
  ) {
    const [rarity, season, types] = await Promise.all([
      transaction.cardRarity.findFirst({
        where: { id: rarityId, isActive: true, deletedAt: null },
      }),
      transaction.cardSeason.findFirst({
        where: { id: seasonId, isActive: true, deletedAt: null },
      }),
      transaction.cardType.findMany({
        where: { id: { in: typeIds }, isActive: true, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    ]);
    if (!rarity) {
      throw new NotFoundException({
        code: 'RARITY_NOT_FOUND',
        message: 'Rareté introuvable ou archivée.',
      });
    }
    if (!season) {
      throw new NotFoundException({
        code: 'SEASON_NOT_FOUND',
        message: 'Saison introuvable ou archivée.',
      });
    }
    if (types.length !== typeIds.length) {
      throw new NotFoundException({
        code: 'CARD_TYPE_NOT_FOUND',
        message: 'Un type est introuvable ou archivé.',
      });
    }
    return { rarity, season, types };
  }

  private audit(
    transaction: PrismaTransactionClient,
    actorUserId: string,
    entityId: string,
    action: string,
    requestId: string,
    beforeData: unknown,
    afterData: unknown,
  ) {
    return transaction.adminAuditLog.create({
      data: {
        actorUserId,
        entityType: 'CARD',
        entityId,
        action,
        requestId,
        ...(beforeData === null ? {} : { beforeData: beforeData as Prisma.InputJsonValue }),
        ...(afterData === null ? {} : { afterData: afterData as Prisma.InputJsonValue }),
      },
    });
  }

  private cardSlug(name: string, number: number): string {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
    return `${base || 'carte'}-${number}`;
  }

  private orderBy(sort: AdminCardsQuery['sort']): Prisma.CardOrderByWithRelationInput {
    switch (sort) {
      case '-number':
        return { number: 'desc' };
      case 'name':
        return { name: 'asc' };
      case '-name':
        return { name: 'desc' };
      case 'updatedAt':
        return { updatedAt: 'asc' };
      case '-updatedAt':
        return { updatedAt: 'desc' };
      default:
        return { number: 'asc' };
    }
  }

  private rethrowCardConstraint(error: unknown): never {
    rethrowPrismaConstraint(error, [
      {
        matches: ['cards_season_number_key', 'season_id,number', 'seasonid number'],
        code: 'CARD_NUMBER_ALREADY_EXISTS_IN_SEASON',
        message: 'Une carte de cette saison utilise déjà ce numéro.',
        fieldErrors: { number: ['Ce numéro est déjà utilisé dans cette saison.'] },
      },
      {
        matches: ['cards_slug_key', 'slug'],
        code: 'CARD_ALREADY_EXISTS',
        message: 'Une carte utilise déjà cet identifiant.',
        fieldErrors: { name: ['Une carte similaire existe déjà.'] },
      },
    ]);
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'Carte introuvable.' });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminTaxonomyQuery,
  CreateCardTypeInput,
  CreateRarityInput,
  CreateSeasonInput,
  UpdateCardTypeInput,
  UpdateRarityInput,
  UpdateSeasonInput,
} from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { rethrowPrismaConstraint } from '../common/errors/prisma-error.js';
import { toCardType, toRarity, toSeason } from '../cards/card.mapper.js';
import { PrismaService, type PrismaTransactionClient } from '../prisma/prisma.service.js';

@Injectable()
export class AdminTaxonomiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRarities(query: AdminTaxonomyQuery) {
    const rows = await this.prisma.cardRarity.findMany({
      where: this.archivedWhere(query),
      include: { _count: { select: { cards: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toRarity);
  }

  async getRarity(id: string) {
    const row = await this.prisma.cardRarity.findUnique({
      where: { id },
      include: { _count: { select: { cards: true } } },
    });
    if (!row) this.notFound('RARITY_NOT_FOUND', 'Rareté introuvable.');
    return toRarity(row);
  }

  async createRarity(actor: AuthenticatedUser, input: CreateRarityInput, requestId: string) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        await this.assertRarityAvailable(transaction, input.name, input.slug);
        const row = await transaction.cardRarity.create({
          data: input,
          include: { _count: { select: { cards: true } } },
        });
        await this.audit(
          transaction,
          actor.id,
          'CARD_RARITY',
          row.id,
          'RARITY_CREATED',
          requestId,
          null,
          input,
        );
        return toRarity(row);
      });
    } catch (error) {
      this.rethrowRarityConstraint(error);
    }
  }

  async updateRarity(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateRarityInput,
    requestId: string,
  ) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        const before = await transaction.cardRarity.findUnique({
          where: { id },
          include: { _count: { select: { cards: true } } },
        });
        if (!before) this.notFound('RARITY_NOT_FOUND', 'Rareté introuvable.');
        await this.assertRarityAvailable(
          transaction,
          input.name ?? before.name,
          input.slug ?? before.slug,
          id,
        );
        const row = await transaction.cardRarity.update({
          where: { id },
          data: input,
          include: { _count: { select: { cards: true } } },
        });
        if (input.name && input.name !== before.name) {
          await transaction.card.updateMany({
            where: { rarityId: id },
            data: { legacyRarity: input.name },
          });
        }
        await this.audit(
          transaction,
          actor.id,
          'CARD_RARITY',
          id,
          'RARITY_UPDATED',
          requestId,
          toRarity(before),
          input,
        );
        return toRarity(row);
      });
    } catch (error) {
      this.rethrowRarityConstraint(error);
    }
  }

  archiveRarity(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setRarityArchived(actor, id, true, requestId);
  }

  restoreRarity(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setRarityArchived(actor, id, false, requestId);
  }

  async deleteRarity(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await transaction.cardRarity.findUnique({
        where: { id },
        include: { _count: { select: { cards: true } } },
      });
      if (!before) this.notFound('RARITY_NOT_FOUND', 'Rareté introuvable.');
      this.assertUnused(before._count.cards, 'cartes');
      await transaction.cardRarity.delete({ where: { id } });
      await this.audit(
        transaction,
        actor.id,
        'CARD_RARITY',
        id,
        'RARITY_DELETED_PERMANENTLY',
        requestId,
        toRarity(before),
        null,
      );
      return { deleted: true, id };
    });
  }

  async listSeasons(query: AdminTaxonomyQuery) {
    const rows = await this.prisma.cardSeason.findMany({
      where: this.archivedWhere(query),
      include: { _count: { select: { cards: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toSeason);
  }

  async getSeason(id: string) {
    const row = await this.prisma.cardSeason.findUnique({
      where: { id },
      include: { _count: { select: { cards: true } } },
    });
    if (!row) this.notFound('SEASON_NOT_FOUND', 'Saison introuvable.');
    return toSeason(row);
  }

  async createSeason(actor: AuthenticatedUser, input: CreateSeasonInput, requestId: string) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        await this.assertSeasonAvailable(transaction, input.name, input.slug, input.code);
        this.assertSeasonDates(input.startDate, input.endDate);
        const row = await transaction.cardSeason.create({
          data: this.seasonData(input),
          include: { _count: { select: { cards: true } } },
        });
        await this.audit(
          transaction,
          actor.id,
          'CARD_SEASON',
          row.id,
          'SEASON_CREATED',
          requestId,
          null,
          input,
        );
        return toSeason(row);
      });
    } catch (error) {
      this.rethrowSeasonConstraint(error);
    }
  }

  async updateSeason(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateSeasonInput,
    requestId: string,
  ) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        const before = await transaction.cardSeason.findUnique({
          where: { id },
          include: { _count: { select: { cards: true } } },
        });
        if (!before) this.notFound('SEASON_NOT_FOUND', 'Saison introuvable.');
        const nextStartDate =
          input.startDate === undefined ? this.dateOnly(before.startDate) : input.startDate;
        const nextEndDate =
          input.endDate === undefined ? this.dateOnly(before.endDate) : input.endDate;
        this.assertSeasonDates(nextStartDate, nextEndDate);
        await this.assertSeasonAvailable(
          transaction,
          input.name ?? before.name,
          input.slug ?? before.slug,
          input.code === undefined ? before.code : input.code,
          id,
        );
        const row = await transaction.cardSeason.update({
          where: { id },
          data: this.seasonData(input),
          include: { _count: { select: { cards: true } } },
        });
        await this.audit(
          transaction,
          actor.id,
          'CARD_SEASON',
          id,
          'SEASON_UPDATED',
          requestId,
          toSeason(before),
          input,
        );
        return toSeason(row);
      });
    } catch (error) {
      this.rethrowSeasonConstraint(error);
    }
  }

  archiveSeason(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setSeasonArchived(actor, id, true, requestId);
  }

  restoreSeason(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setSeasonArchived(actor, id, false, requestId);
  }

  async deleteSeason(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await transaction.cardSeason.findUnique({
        where: { id },
        include: { _count: { select: { cards: true } } },
      });
      if (!before) this.notFound('SEASON_NOT_FOUND', 'Saison introuvable.');
      this.assertUnused(before._count.cards, 'cartes');
      await transaction.cardSeason.delete({ where: { id } });
      await this.audit(
        transaction,
        actor.id,
        'CARD_SEASON',
        id,
        'SEASON_DELETED_PERMANENTLY',
        requestId,
        toSeason(before),
        null,
      );
      return { deleted: true, id };
    });
  }

  async listTypes(query: AdminTaxonomyQuery) {
    const rows = await this.prisma.cardType.findMany({
      where: this.archivedWhere(query),
      include: { _count: { select: { links: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toCardType);
  }

  async getType(id: string) {
    const row = await this.prisma.cardType.findUnique({
      where: { id },
      include: { _count: { select: { links: true } } },
    });
    if (!row) this.notFound('CARD_TYPE_NOT_FOUND', 'Type de carte introuvable.');
    return toCardType(row);
  }

  async createType(actor: AuthenticatedUser, input: CreateCardTypeInput, requestId: string) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        await this.assertTypeAvailable(transaction, input.name, input.slug);
        const row = await transaction.cardType.create({
          data: input,
          include: { _count: { select: { links: true } } },
        });
        await this.audit(
          transaction,
          actor.id,
          'CARD_TYPE',
          row.id,
          'CARD_TYPE_CREATED',
          requestId,
          null,
          input,
        );
        return toCardType(row);
      });
    } catch (error) {
      this.rethrowTypeConstraint(error);
    }
  }

  async updateType(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateCardTypeInput,
    requestId: string,
  ) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        const before = await transaction.cardType.findUnique({
          where: { id },
          include: { _count: { select: { links: true } } },
        });
        if (!before) this.notFound('CARD_TYPE_NOT_FOUND', 'Type de carte introuvable.');
        await this.assertTypeAvailable(
          transaction,
          input.name ?? before.name,
          input.slug ?? before.slug,
          id,
        );
        const row = await transaction.cardType.update({
          where: { id },
          data: input,
          include: { _count: { select: { links: true } } },
        });
        if (input.name && input.name !== before.name) {
          await transaction.card.updateMany({
            where: { legacyCardType: before.name, typeLinks: { some: { typeId: id } } },
            data: { legacyCardType: input.name },
          });
        }
        await this.audit(
          transaction,
          actor.id,
          'CARD_TYPE',
          id,
          'CARD_TYPE_UPDATED',
          requestId,
          toCardType(before),
          input,
        );
        return toCardType(row);
      });
    } catch (error) {
      this.rethrowTypeConstraint(error);
    }
  }

  archiveType(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setTypeArchived(actor, id, true, requestId);
  }

  restoreType(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setTypeArchived(actor, id, false, requestId);
  }

  async deleteType(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await transaction.cardType.findUnique({
        where: { id },
        include: { _count: { select: { links: true } } },
      });
      if (!before) this.notFound('CARD_TYPE_NOT_FOUND', 'Type de carte introuvable.');
      this.assertUnused(before._count.links, 'cartes');
      await transaction.cardType.delete({ where: { id } });
      await this.audit(
        transaction,
        actor.id,
        'CARD_TYPE',
        id,
        'CARD_TYPE_DELETED_PERMANENTLY',
        requestId,
        toCardType(before),
        null,
      );
      return { deleted: true, id };
    });
  }

  private async setRarityArchived(
    actor: AuthenticatedUser,
    id: string,
    archived: boolean,
    requestId: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await transaction.cardRarity.findUnique({
        where: { id },
        include: { _count: { select: { cards: true } } },
      });
      if (!before) this.notFound('RARITY_NOT_FOUND', 'Rareté introuvable.');
      const row = await transaction.cardRarity.update({
        where: { id },
        data: { deletedAt: archived ? new Date() : null, isActive: !archived },
        include: { _count: { select: { cards: true } } },
      });
      await this.audit(
        transaction,
        actor.id,
        'CARD_RARITY',
        id,
        archived ? 'RARITY_ARCHIVED' : 'RARITY_RESTORED',
        requestId,
        toRarity(before),
        toRarity(row),
      );
      return toRarity(row);
    });
  }

  private async setSeasonArchived(
    actor: AuthenticatedUser,
    id: string,
    archived: boolean,
    requestId: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await transaction.cardSeason.findUnique({
        where: { id },
        include: { _count: { select: { cards: true } } },
      });
      if (!before) this.notFound('SEASON_NOT_FOUND', 'Saison introuvable.');
      const row = await transaction.cardSeason.update({
        where: { id },
        data: { deletedAt: archived ? new Date() : null, isActive: !archived },
        include: { _count: { select: { cards: true } } },
      });
      await this.audit(
        transaction,
        actor.id,
        'CARD_SEASON',
        id,
        archived ? 'SEASON_ARCHIVED' : 'SEASON_RESTORED',
        requestId,
        toSeason(before),
        toSeason(row),
      );
      return toSeason(row);
    });
  }

  private async setTypeArchived(
    actor: AuthenticatedUser,
    id: string,
    archived: boolean,
    requestId: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await transaction.cardType.findUnique({
        where: { id },
        include: { _count: { select: { links: true } } },
      });
      if (!before) this.notFound('CARD_TYPE_NOT_FOUND', 'Type de carte introuvable.');
      const row = await transaction.cardType.update({
        where: { id },
        data: { deletedAt: archived ? new Date() : null, isActive: !archived },
        include: { _count: { select: { links: true } } },
      });
      await this.audit(
        transaction,
        actor.id,
        'CARD_TYPE',
        id,
        archived ? 'CARD_TYPE_ARCHIVED' : 'CARD_TYPE_RESTORED',
        requestId,
        toCardType(before),
        toCardType(row),
      );
      return toCardType(row);
    });
  }

  private archivedWhere(query: AdminTaxonomyQuery): {
    deletedAt?: null | { not: null };
    OR?: object[];
  } {
    return {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.archived === 'active'
        ? { deletedAt: null }
        : query.archived === 'archived'
          ? { deletedAt: { not: null } }
          : {}),
    };
  }

  private seasonData(input: CreateSeasonInput): Prisma.CardSeasonCreateInput;
  private seasonData(input: UpdateSeasonInput): Prisma.CardSeasonUpdateInput;
  private seasonData(input: CreateSeasonInput | UpdateSeasonInput) {
    return {
      ...input,
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ? new Date(input.startDate) : null }
        : {}),
      ...(input.endDate !== undefined
        ? { endDate: input.endDate ? new Date(input.endDate) : null }
        : {}),
    };
  }

  private assertUnused(count: number, dependency: string): void {
    if (count > 0) {
      throw new ConflictException({
        code: 'RESOURCE_STILL_REFERENCED',
        message: `Cette ressource est encore utilisée par ${count} ${dependency}.`,
        details: { count, dependency },
      });
    }
  }

  private audit(
    transaction: PrismaTransactionClient,
    actorUserId: string,
    entityType: string,
    entityId: string,
    action: string,
    requestId: string,
    beforeData: unknown,
    afterData: unknown,
  ) {
    return transaction.adminAuditLog.create({
      data: {
        actorUserId,
        entityType,
        entityId,
        action,
        requestId,
        ...(beforeData === null ? {} : { beforeData: beforeData as Prisma.InputJsonValue }),
        ...(afterData === null ? {} : { afterData: afterData as Prisma.InputJsonValue }),
      },
    });
  }

  private async assertRarityAvailable(
    transaction: PrismaTransactionClient,
    name: string,
    slug: string,
    ignoredId?: string,
  ): Promise<void> {
    const duplicate = await transaction.cardRarity.findFirst({
      where: {
        ...(ignoredId ? { id: { not: ignoredId } } : {}),
        OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }],
      },
      select: { name: true, slug: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'RARITY_ALREADY_EXISTS',
        message: 'Une rareté utilise déjà ce nom ou ce slug.',
        fieldErrors:
          duplicate.slug === slug
            ? { slug: ['Ce slug est déjà utilisé.'] }
            : { name: ['Ce nom est déjà utilisé.'] },
      });
    }
  }

  private async assertSeasonAvailable(
    transaction: PrismaTransactionClient,
    name: string,
    slug: string,
    code: string | null | undefined,
    ignoredId?: string,
  ): Promise<void> {
    const duplicate = await transaction.cardSeason.findFirst({
      where: {
        ...(ignoredId ? { id: { not: ignoredId } } : {}),
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { slug },
          ...(code ? [{ code: { equals: code, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { name: true, slug: true, code: true },
    });
    if (!duplicate) return;
    if (code && duplicate.code?.toLowerCase() === code.toLowerCase()) {
      throw new ConflictException({
        code: 'SEASON_CODE_ALREADY_EXISTS',
        message: 'Ce code de saison est déjà utilisé.',
        fieldErrors: { code: ['Ce code est déjà utilisé.'] },
      });
    }
    throw new ConflictException({
      code: 'SEASON_ALREADY_EXISTS',
      message: 'Une saison utilise déjà ce nom ou ce slug.',
      fieldErrors:
        duplicate.slug === slug
          ? { slug: ['Ce slug est déjà utilisé.'] }
          : { name: ['Ce nom est déjà utilisé.'] },
    });
  }

  private async assertTypeAvailable(
    transaction: PrismaTransactionClient,
    name: string,
    slug: string,
    ignoredId?: string,
  ): Promise<void> {
    const duplicate = await transaction.cardType.findFirst({
      where: {
        ...(ignoredId ? { id: { not: ignoredId } } : {}),
        OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }],
      },
      select: { name: true, slug: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'CARD_TYPE_ALREADY_EXISTS',
        message: 'Un type utilise déjà ce nom ou ce slug.',
        fieldErrors:
          duplicate.slug === slug
            ? { slug: ['Ce slug est déjà utilisé.'] }
            : { name: ['Ce nom est déjà utilisé.'] },
      });
    }
  }

  private assertSeasonDates(startDate?: string | null, endDate?: string | null): void {
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new ConflictException({
        code: 'SEASON_INVALID_DATES',
        message: 'La date de fin doit être postérieure à la date de début.',
        fieldErrors: {
          endDate: ['La date de fin doit être postérieure à la date de début.'],
        },
      });
    }
  }

  private dateOnly(value: Date | null): string | null {
    return value?.toISOString().slice(0, 10) ?? null;
  }

  private rethrowRarityConstraint(error: unknown): never {
    rethrowPrismaConstraint(error, [
      {
        matches: ['card_rarities_name_lower_key', 'name'],
        code: 'RARITY_ALREADY_EXISTS',
        message: 'Une rareté utilise déjà ce nom.',
        fieldErrors: { name: ['Ce nom est déjà utilisé.'] },
      },
      {
        matches: ['card_rarities_slug_key', 'slug'],
        code: 'RARITY_ALREADY_EXISTS',
        message: 'Une rareté utilise déjà ce slug.',
        fieldErrors: { slug: ['Ce slug est déjà utilisé.'] },
      },
    ]);
  }

  private rethrowSeasonConstraint(error: unknown): never {
    rethrowPrismaConstraint(error, [
      {
        matches: ['card_seasons_code_lower_key', 'code'],
        code: 'SEASON_CODE_ALREADY_EXISTS',
        message: 'Ce code de saison est déjà utilisé.',
        fieldErrors: { code: ['Ce code est déjà utilisé.'] },
      },
      {
        matches: ['card_seasons_name_lower_key', 'name'],
        code: 'SEASON_ALREADY_EXISTS',
        message: 'Une saison utilise déjà ce nom.',
        fieldErrors: { name: ['Ce nom est déjà utilisé.'] },
      },
      {
        matches: ['card_seasons_slug_key', 'slug'],
        code: 'SEASON_ALREADY_EXISTS',
        message: 'Une saison utilise déjà ce slug.',
        fieldErrors: { slug: ['Ce slug est déjà utilisé.'] },
      },
    ]);
  }

  private rethrowTypeConstraint(error: unknown): never {
    rethrowPrismaConstraint(error, [
      {
        matches: ['card_types_name_lower_key', 'name'],
        code: 'CARD_TYPE_ALREADY_EXISTS',
        message: 'Un type utilise déjà ce nom.',
        fieldErrors: { name: ['Ce nom est déjà utilisé.'] },
      },
      {
        matches: ['card_types_slug_key', 'slug'],
        code: 'CARD_TYPE_ALREADY_EXISTS',
        message: 'Un type utilise déjà ce slug.',
        fieldErrors: { slug: ['Ce slug est déjà utilisé.'] },
      },
    ]);
  }

  private notFound(code: string, message: string): never {
    throw new NotFoundException({ code, message });
  }
}

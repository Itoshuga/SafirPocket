import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdminBoosterDetails, BoosterValidationResult } from '@safir/shared-types';
import type {
  AdminBoostersQuery,
  CreateBoosterInput,
  UpdateBoosterDropRatesInput,
  UpdateBoosterInput,
} from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { BoosterDrawService } from '../boosters/booster-draw.service.js';
import { rethrowPrismaConstraint } from '../common/errors/prisma-error.js';
import { PrismaService, type PrismaTransactionClient } from '../prisma/prisma.service.js';

const boosterInclude = {
  season: true,
  guaranteedCommonRarity: true,
  dropRates: {
    include: { rarity: true },
    orderBy: [{ sortOrder: 'asc' }, { rarity: { name: 'asc' } }],
  },
  _count: { select: { openings: true } },
} satisfies Prisma.BoosterProductInclude;

type BoosterWithRelations = Prisma.BoosterProductGetPayload<{ include: typeof boosterInclude }>;
type BoosterInput = CreateBoosterInput | UpdateBoosterInput;

@Injectable()
export class AdminBoostersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly draw: BoosterDrawService,
  ) {}

  async list(query: AdminBoostersQuery) {
    const where: Prisma.BoosterProductWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.seasonId ? { seasonId: query.seasonId } : {}),
      ...(query.active ? { isActive: query.active === 'true' } : {}),
      ...(query.archived === 'active'
        ? { deletedAt: null }
        : query.archived === 'archived'
          ? { deletedAt: { not: null } }
          : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.boosterProduct.findMany({
        where,
        include: boosterInclude,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.boosterProduct.count({ where }),
    ]);
    const data = await Promise.all(
      rows.map((row) => this.serializeWithValidation(this.prisma, row)),
    );
    return {
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(id: string): Promise<AdminBoosterDetails> {
    const row = await this.prisma.boosterProduct.findUnique({
      where: { id },
      include: boosterInclude,
    });
    if (!row) this.notFound();
    return this.serializeWithValidation(this.prisma, row);
  }

  async create(actor: AuthenticatedUser, input: CreateBoosterInput, requestId: string) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        await this.assertReferences(transaction, input);
        this.draw.assertRates(input.dropRates, input.guaranteedCommonRarityId);
        const created = await transaction.boosterProduct.create({
          data: {
            seasonId: input.seasonId,
            guaranteedCommonRarityId: input.guaranteedCommonRarityId,
            name: input.name,
            slug: input.slug,
            description: input.description,
            imageUrl: input.imageUrl,
            artworkPath: input.imageUrl,
            priceAmount: BigInt(input.costAmount),
            priceCurrency: input.currencyCode,
            cardsPerPack: 8,
            commonCardCount: 6,
            premiumCardCount: 2,
            status: input.isActive ? 'published' : 'draft',
            isActive: input.isActive,
            availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
            availableUntil: input.availableUntil ? new Date(input.availableUntil) : null,
            sortOrder: input.sortOrder,
          },
        });
        await transaction.boosterRarityDropRate.createMany({
          data: input.dropRates.map((rate) => ({ boosterId: created.id, ...rate })),
        });
        const row = await this.requireBooster(transaction, created.id);
        const validation = await this.validateState(transaction, row);
        if (input.isActive) this.throwIfInvalid(validation);
        const result = this.serialize(row, validation);
        await this.audit(transaction, actor.id, row.id, 'BOOSTER_CREATED', requestId, null, result);
        return result;
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateBoosterInput, requestId: string) {
    try {
      return await this.prisma.runInTransaction(async (transaction) => {
        const before = await this.requireBooster(transaction, id);
        const next = {
          seasonId: input.seasonId ?? before.seasonId,
          guaranteedCommonRarityId:
            input.guaranteedCommonRarityId ?? before.guaranteedCommonRarityId,
          dropRates:
            input.dropRates ??
            before.dropRates.map(({ rarityId, dropRateBps, sortOrder }) => ({
              rarityId,
              dropRateBps,
              sortOrder,
            })),
        };
        await this.assertReferences(transaction, next);
        this.draw.assertRates(next.dropRates, next.guaranteedCommonRarityId);
        if (input.dropRates) {
          await transaction.boosterRarityDropRate.deleteMany({ where: { boosterId: id } });
        }
        const active = input.isActive ?? before.isActive;
        const row = await transaction.boosterProduct.update({
          where: { id },
          data: {
            ...this.productData(input),
            cardsPerPack: 8,
            commonCardCount: 6,
            premiumCardCount: 2,
            ...(input.isActive !== undefined
              ? { status: input.isActive ? 'published' : 'draft' }
              : {}),
            ...(input.dropRates ? { dropRates: { create: input.dropRates } } : {}),
          },
          include: boosterInclude,
        });
        const validation = await this.validateState(transaction, row);
        if (active) this.throwIfInvalid(validation);
        const beforeResult = this.serialize(before, await this.validateState(transaction, before));
        const result = this.serialize(row, validation);
        await this.audit(
          transaction,
          actor.id,
          id,
          'BOOSTER_UPDATED',
          requestId,
          beforeResult,
          result,
        );
        return result;
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async duplicate(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const source = await this.requireBooster(transaction, id);
      const identity = await this.duplicateIdentity(transaction, source);
      const created = await transaction.boosterProduct.create({
        data: {
          seasonId: source.seasonId,
          guaranteedCommonRarityId: source.guaranteedCommonRarityId,
          name: identity.name,
          slug: identity.slug,
          description: source.description,
          imageUrl: source.imageUrl,
          artworkPath: source.imageUrl,
          priceAmount: source.priceAmount,
          priceCurrency: source.priceCurrency,
          cardsPerPack: 8,
          commonCardCount: 6,
          premiumCardCount: 2,
          status: 'draft',
          isActive: false,
          availableFrom: source.availableFrom,
          availableUntil: source.availableUntil,
          sortOrder: source.sortOrder,
        },
      });
      await transaction.boosterRarityDropRate.createMany({
        data: source.dropRates.map(({ rarityId, dropRateBps, sortOrder }) => ({
          boosterId: created.id,
          rarityId,
          dropRateBps,
          sortOrder,
        })),
      });
      const row = await this.requireBooster(transaction, created.id);
      const result = this.serialize(row, await this.validateState(transaction, row));
      await this.audit(
        transaction,
        actor.id,
        row.id,
        'BOOSTER_DUPLICATED',
        requestId,
        { sourceId: id },
        result,
      );
      return result;
    });
  }

  activate(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setActive(actor, id, true, requestId);
  }

  deactivate(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.setActive(actor, id, false, requestId);
  }

  async archive(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await this.requireBooster(transaction, id);
      const row = await transaction.boosterProduct.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, status: 'archived' },
        include: boosterInclude,
      });
      const result = this.serialize(row, await this.validateState(transaction, row));
      await this.audit(
        transaction,
        actor.id,
        id,
        'BOOSTER_ARCHIVED',
        requestId,
        this.snapshot(before),
        result,
      );
      return result;
    });
  }

  async restore(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await this.requireBooster(transaction, id);
      const row = await transaction.boosterProduct.update({
        where: { id },
        data: { deletedAt: null, isActive: false, status: 'draft' },
        include: boosterInclude,
      });
      const result = this.serialize(row, await this.validateState(transaction, row));
      await this.audit(
        transaction,
        actor.id,
        id,
        'BOOSTER_RESTORED',
        requestId,
        this.snapshot(before),
        result,
      );
      return result;
    });
  }

  async permanentlyDelete(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await this.requireBooster(transaction, id);
      if (before._count.openings > 0) {
        throw new ConflictException({
          code: 'RESOURCE_STILL_REFERENCED',
          message: 'Ce booster possède un historique et ne peut pas être supprimé définitivement.',
          details: { openings: before._count.openings },
        });
      }
      await transaction.boosterProduct.delete({ where: { id } });
      await this.audit(
        transaction,
        actor.id,
        id,
        'BOOSTER_DELETED_PERMANENTLY',
        requestId,
        this.snapshot(before),
        null,
      );
      return { deleted: true, id };
    });
  }

  async getDropRates(id: string) {
    const booster = await this.requireBooster(this.prisma, id);
    return booster.dropRates.map((rate) => this.serializeRate(rate));
  }

  async updateDropRates(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateBoosterDropRatesInput,
    requestId: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const booster = await this.requireBooster(transaction, id);
      this.draw.assertRates(input.dropRates, booster.guaranteedCommonRarityId);
      await this.assertReferences(transaction, {
        seasonId: booster.seasonId,
        guaranteedCommonRarityId: booster.guaranteedCommonRarityId,
        dropRates: input.dropRates,
      });
      const before = booster.dropRates.map((rate) => this.serializeRate(rate));
      await transaction.boosterRarityDropRate.deleteMany({ where: { boosterId: id } });
      await transaction.boosterRarityDropRate.createMany({
        data: input.dropRates.map((rate) => ({ boosterId: id, ...rate })),
      });
      const row = await this.requireBooster(transaction, id);
      const validation = await this.validateState(transaction, row);
      if (row.isActive) this.throwIfInvalid(validation);
      const after = row.dropRates.map((rate) => this.serializeRate(rate));
      await this.audit(
        transaction,
        actor.id,
        id,
        'BOOSTER_DROP_RATES_UPDATED',
        requestId,
        before,
        after,
      );
      return after;
    });
  }

  async validate(id: string): Promise<BoosterValidationResult> {
    const booster = await this.requireBooster(this.prisma, id);
    return this.validateState(this.prisma, booster);
  }

  private async setActive(
    actor: AuthenticatedUser,
    id: string,
    active: boolean,
    requestId: string,
  ) {
    return this.prisma.runInTransaction(async (transaction) => {
      const before = await this.requireBooster(transaction, id);
      if (before.deletedAt) {
        throw new ConflictException({
          code: 'BOOSTER_ARCHIVED',
          message: 'Restaurez ce booster avant de l’activer.',
        });
      }
      const validation = await this.validateState(transaction, before);
      if (active) this.throwIfInvalid(validation);
      const row = await transaction.boosterProduct.update({
        where: { id },
        data: { isActive: active, status: active ? 'published' : 'draft' },
        include: boosterInclude,
      });
      const result = this.serialize(row, validation);
      await this.audit(
        transaction,
        actor.id,
        id,
        active ? 'BOOSTER_ACTIVATED' : 'BOOSTER_DEACTIVATED',
        requestId,
        this.snapshot(before),
        result,
      );
      return result;
    });
  }

  private async serializeWithValidation(
    client: PrismaService | PrismaTransactionClient,
    row: BoosterWithRelations,
  ) {
    return this.serialize(row, await this.validateState(client, row));
  }

  private serialize(
    row: BoosterWithRelations,
    validation: BoosterValidationResult,
  ): AdminBoosterDetails {
    const now = new Date();
    const isAvailable =
      row.isActive &&
      !row.deletedAt &&
      (!row.availableFrom || row.availableFrom <= now) &&
      (!row.availableUntil || row.availableUntil > now);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      season: this.season(row.season),
      guaranteedCommonRarity: this.rarity(row.guaranteedCommonRarity),
      cardsPerPack: row.cardsPerPack,
      commonCardCount: row.commonCardCount,
      premiumCardCount: row.premiumCardCount,
      cost: { amount: Number(row.priceAmount), currencyCode: row.priceCurrency },
      status: row.status,
      isActive: row.isActive,
      isAvailable,
      unavailableReason: this.unavailableReason(row, now),
      availableFrom: row.availableFrom?.toISOString() ?? null,
      availableUntil: row.availableUntil?.toISOString() ?? null,
      sortOrder: row.sortOrder,
      dropRates: row.dropRates.map((rate) => this.serializeRate(rate)),
      validation,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      openingCount: row._count.openings,
    };
  }

  private async validateState(
    client: PrismaService | PrismaTransactionClient,
    booster: BoosterWithRelations,
  ): Promise<BoosterValidationResult> {
    const errors: BoosterValidationResult['errors'] = [];
    const rates = booster.dropRates;
    const total = rates.reduce((sum, rate) => sum + rate.dropRateBps, 0);
    if (!booster.season.isActive || booster.season.deletedAt) {
      errors.push({
        code: 'BOOSTER_SEASON_ARCHIVED',
        message: 'La saison est inactive ou archivée.',
      });
    }
    if (!booster.guaranteedCommonRarity.isActive || booster.guaranteedCommonRarity.deletedAt) {
      errors.push({
        code: 'BOOSTER_INVALID_CONFIGURATION',
        message: 'La rareté commune est inactive ou archivée.',
      });
    }
    if (!rates.length) {
      errors.push({
        code: 'BOOSTER_DROP_RATES_INCOMPLETE',
        message: 'Aucune rareté premium n’est configurée.',
      });
    }
    if (total !== 10_000) {
      errors.push({
        code: 'BOOSTER_DROP_RATES_TOTAL_INVALID',
        message: 'Le total des taux doit être exactement égal à 100 %.',
      });
    }
    if (rates.some(({ rarityId }) => rarityId === booster.guaranteedCommonRarityId)) {
      errors.push({
        code: 'BOOSTER_INVALID_CONFIGURATION',
        message: 'La rareté commune figure dans les taux premium.',
      });
    }
    if (
      booster.availableFrom &&
      booster.availableUntil &&
      booster.availableUntil <= booster.availableFrom
    ) {
      errors.push({
        code: 'BOOSTER_INVALID_AVAILABILITY_DATES',
        message: 'La période de disponibilité est invalide.',
      });
    }
    const rarityIds = [booster.guaranteedCommonRarityId, ...rates.map(({ rarityId }) => rarityId)];
    const pools = await client.card.groupBy({
      by: ['rarityId'],
      where: {
        seasonId: booster.seasonId,
        rarityId: { in: rarityIds },
        status: 'published',
        isActive: true,
        deletedAt: null,
        variants: { some: {} },
      },
      _count: { _all: true },
    });
    const counts = new Map(pools.map((pool) => [pool.rarityId, pool._count._all]));
    const commonCardCount = counts.get(booster.guaranteedCommonRarityId) ?? 0;
    if (!commonCardCount) {
      errors.push({
        code: 'BOOSTER_HAS_NO_COMMON_CARDS',
        message: 'Aucune carte commune active n’existe dans cette saison.',
      });
    }
    const premiumPools = rates.map(({ rarityId }) => ({
      rarityId,
      cardCount: counts.get(rarityId) ?? 0,
    }));
    for (const pool of premiumPools) {
      if (!pool.cardCount) {
        errors.push({
          code: 'BOOSTER_RARITY_POOL_EMPTY',
          message: 'Une rareté premium ne contient aucune carte active dans cette saison.',
          rarityId: pool.rarityId,
        });
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      commonCardCount,
      premiumPools,
      dropRateTotalBps: total,
    };
  }

  private throwIfInvalid(validation: BoosterValidationResult): never | void {
    const first = validation.errors[0];
    if (first) {
      throw new BadRequestException({
        code: first.code,
        message: first.message,
        details: { validation },
      });
    }
  }

  private async assertReferences(
    transaction: PrismaService | PrismaTransactionClient,
    input: {
      seasonId: string;
      guaranteedCommonRarityId: string;
      dropRates: Array<{ rarityId: string }>;
    },
  ): Promise<void> {
    const rarityIds = [
      input.guaranteedCommonRarityId,
      ...input.dropRates.map(({ rarityId }) => rarityId),
    ];
    const [season, rarities] = await Promise.all([
      transaction.cardSeason.findFirst({
        where: { id: input.seasonId, isActive: true, deletedAt: null },
      }),
      transaction.cardRarity.findMany({
        where: { id: { in: rarityIds }, isActive: true, deletedAt: null },
      }),
    ]);
    if (!season)
      throw new BadRequestException({
        code: 'BOOSTER_SEASON_ARCHIVED',
        message: 'La saison est introuvable, inactive ou archivée.',
      });
    if (rarities.length !== new Set(rarityIds).size) {
      throw new BadRequestException({
        code: 'BOOSTER_INVALID_CONFIGURATION',
        message: 'Une rareté est introuvable, inactive ou archivée.',
      });
    }
  }

  private productData(input: BoosterInput): Prisma.BoosterProductUncheckedUpdateInput {
    return {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: input.imageUrl, artworkPath: input.imageUrl }
        : {}),
      ...(input.seasonId !== undefined ? { seasonId: input.seasonId } : {}),
      ...(input.guaranteedCommonRarityId !== undefined
        ? { guaranteedCommonRarityId: input.guaranteedCommonRarityId }
        : {}),
      ...(input.costAmount !== undefined ? { priceAmount: BigInt(input.costAmount) } : {}),
      ...(input.currencyCode !== undefined ? { priceCurrency: input.currencyCode } : {}),
      ...(input.availableFrom !== undefined
        ? { availableFrom: input.availableFrom ? new Date(input.availableFrom) : null }
        : {}),
      ...(input.availableUntil !== undefined
        ? { availableUntil: input.availableUntil ? new Date(input.availableUntil) : null }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
  }

  private async requireBooster(
    client: PrismaService | PrismaTransactionClient,
    id: string,
  ): Promise<BoosterWithRelations> {
    const row = await client.boosterProduct.findUnique({ where: { id }, include: boosterInclude });
    if (!row) this.notFound();
    return row;
  }

  private async duplicateIdentity(
    transaction: PrismaTransactionClient,
    source: BoosterWithRelations,
  ) {
    for (let index = 1; index <= 100; index += 1) {
      const suffix = index === 1 ? 'copie' : `copie-${index}`;
      const name = `${source.name} (${index === 1 ? 'copie' : `copie ${index}`})`.slice(0, 150);
      const slug = `${source.slug}-${suffix}`.slice(0, 160);
      const exists = await transaction.boosterProduct.findFirst({
        where: { OR: [{ slug }, { seasonId: source.seasonId, name }] },
        select: { id: true },
      });
      if (!exists) return { name, slug };
    }
    throw new ConflictException({
      code: 'BOOSTER_DUPLICATE_LIMIT',
      message: 'Impossible de générer une identité unique pour la copie.',
    });
  }

  private unavailableReason(row: BoosterWithRelations, now: Date): string | null {
    if (row.deletedAt) return 'BOOSTER_ARCHIVED';
    if (!row.isActive) return 'BOOSTER_NOT_ACTIVE';
    if (row.availableFrom && row.availableFrom > now) return 'BOOSTER_NOT_AVAILABLE';
    if (row.availableUntil && row.availableUntil <= now) return 'BOOSTER_NOT_AVAILABLE';
    return null;
  }

  private serializeRate(rate: BoosterWithRelations['dropRates'][number]) {
    return {
      rarity: this.rarity(rate.rarity),
      dropRateBps: rate.dropRateBps,
      sortOrder: rate.sortOrder,
    };
  }

  private rarity(rarity: BoosterWithRelations['guaranteedCommonRarity']) {
    return {
      id: rarity.id,
      name: rarity.name,
      slug: rarity.slug,
      displayColor: rarity.displayColor,
    };
  }

  private season(season: BoosterWithRelations['season']) {
    return { id: season.id, name: season.name, slug: season.slug, code: season.code };
  }

  private snapshot(row: BoosterWithRelations) {
    return {
      id: row.id,
      seasonId: row.seasonId,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      status: row.status,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      dropRates: row.dropRates.map(({ rarityId, dropRateBps, sortOrder }) => ({
        rarityId,
        dropRateBps,
        sortOrder,
      })),
    };
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
        entityType: 'BOOSTER_PRODUCT',
        entityId,
        action,
        requestId,
        ...(beforeData === null ? {} : { beforeData: beforeData as Prisma.InputJsonValue }),
        ...(afterData === null ? {} : { afterData: afterData as Prisma.InputJsonValue }),
      },
    });
  }

  private orderBy(
    sort: AdminBoostersQuery['sort'],
  ): Prisma.BoosterProductOrderByWithRelationInput[] {
    switch (sort) {
      case '-name':
        return [{ name: 'desc' }];
      case 'updatedAt':
        return [{ updatedAt: 'asc' }];
      case '-updatedAt':
        return [{ updatedAt: 'desc' }];
      case 'name':
        return [{ name: 'asc' }];
      default:
        return [{ sortOrder: 'asc' }, { name: 'asc' }];
    }
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'BOOSTER_NOT_FOUND', message: 'Booster introuvable.' });
  }

  private rethrowConstraint(error: unknown): never {
    rethrowPrismaConstraint(error, [
      {
        matches: ['booster_products_slug_key', 'slug'],
        code: 'BOOSTER_ALREADY_EXISTS',
        message: 'Un booster utilise déjà ce slug.',
        fieldErrors: { slug: ['Ce slug est déjà utilisé.'] },
      },
      {
        matches: ['booster_products_season_name_key', 'season_id,name'],
        code: 'BOOSTER_ALREADY_EXISTS',
        message: 'Un booster de cette saison utilise déjà ce nom.',
        fieldErrors: { name: ['Ce nom est déjà utilisé dans cette saison.'] },
      },
    ]);
  }
}

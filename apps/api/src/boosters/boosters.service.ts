import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BoosterProduct, OpenBoosterResult, PackOpening } from '@safir/shared-types';
import type { PackOpeningsQuery } from '@safir/validation';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoosterDrawService } from './booster-draw.service.js';

const publicBoosterInclude = {
  season: true,
  guaranteedCommonRarity: true,
} satisfies Prisma.BoosterProductInclude;

const configuredBoosterInclude = {
  ...publicBoosterInclude,
  dropRates: {
    include: { rarity: true },
    orderBy: [{ sortOrder: 'asc' }, { rarity: { name: 'asc' } }],
  },
} satisfies Prisma.BoosterProductInclude;

const openingInclude = {
  season: true,
  boosterProduct: true,
  cards: {
    include: { card: true, rarity: true, cardVariant: true },
    orderBy: { slotPosition: 'asc' },
  },
} satisfies Prisma.PackOpeningInclude;

type PublicBoosterRow = Prisma.BoosterProductGetPayload<{ include: typeof publicBoosterInclude }>;
type ConfiguredBoosterRow = Prisma.BoosterProductGetPayload<{
  include: typeof configuredBoosterInclude;
}>;
type OpeningRow = Prisma.PackOpeningGetPayload<{ include: typeof openingInclude }>;
type PoolCard = Prisma.CardGetPayload<{
  include: { rarity: true; variants: true };
}>;

@Injectable()
export class BoostersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly draw: BoosterDrawService,
  ) {}

  async listProducts(): Promise<BoosterProduct[]> {
    const products = await this.prisma.boosterProduct.findMany({
      where: { status: 'published', isActive: true, deletedAt: null },
      include: publicBoosterInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((product) => this.serializeProduct(product));
  }

  async getProduct(id: string): Promise<BoosterProduct> {
    const product = await this.prisma.boosterProduct.findFirst({
      where: { id, status: 'published', isActive: true, deletedAt: null },
      include: publicBoosterInclude,
    });
    if (!product) this.notFound();
    return this.serializeProduct(product);
  }

  async publicDropRates(id: string) {
    const product = await this.prisma.boosterProduct.findFirst({
      where: { id, status: 'published', isActive: true, deletedAt: null },
      select: {
        id: true,
        dropRates: {
          select: {
            dropRateBps: true,
            sortOrder: true,
            rarity: { select: { id: true, name: true, slug: true, displayColor: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { rarity: { name: 'asc' } }],
        },
      },
    });
    if (!product) this.notFound();
    return product.dropRates;
  }

  async openPack(
    userId: string,
    productId: string,
    idempotencyKey: string,
  ): Promise<OpenBoosterResult> {
    const previous = await this.findCompleted(userId, idempotencyKey);
    if (previous) return this.serializeOpening(previous);

    try {
      const opening = await this.prisma.runInTransaction(
        async (transaction) => {
          const existing = await transaction.packOpening.findUnique({
            where: { userId_idempotencyKey: { userId, idempotencyKey } },
            include: openingInclude,
          });
          if (existing) {
            if (existing.status === 'completed') return existing;
            throw new ConflictException({
              code: 'PACK_OPENING_ALREADY_EXISTS',
              message: 'Cette ouverture est déjà en cours.',
            });
          }

          const now = new Date();
          const product = await transaction.boosterProduct.findUnique({
            where: { id: productId },
            include: configuredBoosterInclude,
          });
          this.assertOpenable(product, now);
          const rates = product.dropRates.map(({ rarityId, dropRateBps }) => ({
            rarityId,
            dropRateBps,
          }));
          this.draw.assertRates(rates, product.guaranteedCommonRarityId);

          const rarityIds = [
            product.guaranteedCommonRarityId,
            ...product.dropRates.map(({ rarityId }) => rarityId),
          ];
          const eligibleCards = await transaction.card.findMany({
            where: {
              seasonId: product.seasonId,
              rarityId: { in: rarityIds },
              status: 'published',
              isActive: true,
              deletedAt: null,
              variants: { some: {} },
            },
            include: {
              rarity: true,
              variants: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], take: 1 },
            },
            orderBy: [{ number: 'asc' }, { id: 'asc' }],
          });
          const commonCards = eligibleCards.filter(
            ({ rarityId }) => rarityId === product.guaranteedCommonRarityId,
          );
          const premiumCards = new Map<string, PoolCard[]>();
          for (const rate of product.dropRates) {
            premiumCards.set(
              rate.rarityId,
              eligibleCards.filter(({ rarityId }) => rarityId === rate.rarityId),
            );
          }
          const drawn = this.draw.draw(commonCards, premiumCards, rates);

          if (product.priceAmount > 0n) {
            await this.debitWallet(transaction, userId, product, idempotencyKey);
          }

          const created = await transaction.packOpening.create({
            data: {
              userId,
              boosterProductId: product.id,
              seasonId: product.seasonId,
              idempotencyKey,
              status: 'pending',
              priceCurrency: product.priceCurrency,
              priceAmount: product.priceAmount,
              boosterNameSnapshot: product.name,
            },
          });

          for (const result of drawn) {
            const variant = result.card.variants[0]!;
            const inventory = await transaction.userCard.upsert({
              where: { userId_cardVariantId: { userId, cardVariantId: variant.id } },
              create: {
                userId,
                cardVariantId: variant.id,
                quantity: 1,
                firstObtainedAt: now,
                lastObtainedAt: now,
              },
              update: { quantity: { increment: 1 }, lastObtainedAt: now },
            });
            const previousQuantity = inventory.quantity - 1;
            await transaction.packOpeningCard.create({
              data: {
                packOpeningId: created.id,
                cardId: result.card.id,
                cardVariantId: variant.id,
                rarityId: result.card.rarityId,
                slotIndex: result.slotPosition,
                slotPosition: result.slotPosition,
                slotCategory: result.slotCategory,
                quantity: 1,
                probabilityData:
                  result.dropRateBps === null
                    ? { guaranteed: true }
                    : { dropRateBps: result.dropRateBps },
                cardNameSnapshot: result.card.name,
                rarityNameSnapshot: result.card.rarity.name,
                previousQuantity,
                newQuantity: inventory.quantity,
              },
            });
          }

          return transaction.packOpening.update({
            where: { id: created.id },
            data: { status: 'completed', openedAt: now },
            include: openingInclude,
          });
        },
        { isolationLevel: 'Serializable', timeout: 15_000 },
      );
      return this.serializeOpening(opening);
    } catch (error) {
      const completed = await this.findCompleted(userId, idempotencyKey);
      if (completed) return this.serializeOpening(completed);
      throw error;
    }
  }

  async openings(userId: string, query: PackOpeningsQuery) {
    const where = { userId, status: 'completed' as const };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.packOpening.findMany({
        where,
        include: openingInclude,
        orderBy: { openedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.packOpening.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.serializePackOpening(row)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async opening(userId: string, openingId: string): Promise<PackOpening> {
    const row = await this.prisma.packOpening.findFirst({
      where: { id: openingId, userId, status: 'completed' },
      include: openingInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'PACK_OPENING_NOT_FOUND',
        message: 'Ouverture introuvable.',
      });
    }
    return this.serializePackOpening(row);
  }

  async recentOpenings(userId: string): Promise<PackOpening[]> {
    const response = await this.openings(userId, { page: 1, pageSize: 12 });
    return response.data;
  }

  private assertOpenable(
    product: ConfiguredBoosterRow | null,
    now: Date,
  ): asserts product is ConfiguredBoosterRow {
    if (!product) this.notFound();
    if (product.deletedAt) {
      throw new NotFoundException({ code: 'BOOSTER_ARCHIVED', message: 'Ce booster est archivé.' });
    }
    if (!product.isActive || product.status !== 'published') {
      throw new BadRequestException({
        code: 'BOOSTER_NOT_ACTIVE',
        message: 'Ce booster n’est pas actif.',
      });
    }
    if (product.availableFrom && product.availableFrom > now) {
      throw new BadRequestException({
        code: 'BOOSTER_NOT_AVAILABLE',
        message: 'Ce booster n’est pas encore disponible.',
      });
    }
    if (product.availableUntil && product.availableUntil <= now) {
      throw new BadRequestException({
        code: 'BOOSTER_NOT_AVAILABLE',
        message: 'Ce booster n’est plus disponible.',
      });
    }
    if (!product.season.isActive || product.season.deletedAt) {
      throw new BadRequestException({
        code: 'BOOSTER_SEASON_NOT_FOUND',
        message: 'La saison de ce booster est indisponible.',
      });
    }
    if (
      product.cardsPerPack !== 8 ||
      product.commonCardCount !== 6 ||
      product.premiumCardCount !== 2
    ) {
      throw new BadRequestException({
        code: 'BOOSTER_INVALID_CONFIGURATION',
        message: 'La configuration du booster ne respecte pas la répartition Safir.',
      });
    }
  }

  private async debitWallet(
    transaction: Parameters<Parameters<PrismaService['runInTransaction']>[0]>[0],
    userId: string,
    product: ConfiguredBoosterRow,
    idempotencyKey: string,
  ) {
    if (!product.priceCurrency) {
      throw new BadRequestException({
        code: 'BOOSTER_INVALID_CONFIGURATION',
        message: 'La monnaie de ce booster payant est absente.',
      });
    }
    const wallet = await transaction.wallet.findUnique({
      where: { userId_currencyCode: { userId, currencyCode: product.priceCurrency } },
    });
    if (!wallet || wallet.balance < product.priceAmount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: 'Votre solde est insuffisant.',
      });
    }
    const debited = await transaction.wallet.updateMany({
      where: {
        userId,
        currencyCode: product.priceCurrency,
        balance: { gte: product.priceAmount },
      },
      data: { balance: { decrement: product.priceAmount } },
    });
    if (debited.count !== 1) {
      throw new ConflictException({
        code: 'WALLET_CONCURRENT_UPDATE',
        message: 'Votre solde a changé. Réessayez.',
      });
    }
    await transaction.currencyTransaction.create({
      data: {
        userId,
        currencyCode: product.priceCurrency,
        amount: -product.priceAmount,
        balanceAfter: wallet.balance - product.priceAmount,
        reason: 'BOOSTER_OPENING',
        referenceType: 'booster_product',
        referenceId: product.id,
        idempotencyKey,
        metadata: { boosterName: product.name },
      },
    });
  }

  private findCompleted(userId: string, idempotencyKey: string) {
    return this.prisma.packOpening.findFirst({
      where: { userId, idempotencyKey, status: 'completed' },
      include: openingInclude,
    });
  }

  private serializeProduct(row: PublicBoosterRow): BoosterProduct {
    const now = new Date();
    const unavailableReason =
      row.availableFrom && row.availableFrom > now
        ? 'BOOSTER_NOT_AVAILABLE'
        : row.availableUntil && row.availableUntil <= now
          ? 'BOOSTER_NOT_AVAILABLE'
          : null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      season: {
        id: row.season.id,
        name: row.season.name,
        slug: row.season.slug,
        code: row.season.code,
      },
      guaranteedCommonRarity: {
        id: row.guaranteedCommonRarity.id,
        name: row.guaranteedCommonRarity.name,
        slug: row.guaranteedCommonRarity.slug,
        displayColor: row.guaranteedCommonRarity.displayColor,
      },
      cardsPerPack: row.cardsPerPack,
      commonCardCount: row.commonCardCount,
      premiumCardCount: row.premiumCardCount,
      cost: { amount: Number(row.priceAmount), currencyCode: row.priceCurrency },
      status: row.status,
      isActive: row.isActive,
      isAvailable: unavailableReason === null,
      unavailableReason,
      availableFrom: row.availableFrom?.toISOString() ?? null,
      availableUntil: row.availableUntil?.toISOString() ?? null,
      sortOrder: row.sortOrder,
    };
  }

  private serializePackOpening(row: OpeningRow): PackOpening {
    const result = this.serializeOpening(row);
    return {
      id: result.openingId,
      booster: result.booster,
      status: 'completed',
      cost: result.cost,
      openedAt: result.openedAt,
      cards: result.cards,
    };
  }

  private serializeOpening(row: OpeningRow): OpenBoosterResult {
    return {
      openingId: row.id,
      booster: {
        id: row.boosterProduct.id,
        name: row.boosterNameSnapshot,
        imageUrl: row.boosterProduct.imageUrl,
        season: {
          id: row.season.id,
          name: row.season.name,
          slug: row.season.slug,
          code: row.season.code,
        },
      },
      cards: row.cards.map((result) => ({
        slotPosition: result.slotPosition,
        slotCategory: result.slotCategory,
        card: {
          id: result.card.id,
          name: result.cardNameSnapshot,
          number: Number(result.card.number),
          imageUrl: result.card.imageUrl,
          attack: Number(result.card.attack),
          defense: Number(result.card.defense),
          value: Number(result.card.value),
        },
        variant: {
          id: result.cardVariant.id,
          name: result.cardVariant.name,
          slug: result.cardVariant.slug,
          finish: result.cardVariant.finish,
          artworkPath: result.cardVariant.artworkPath,
        },
        rarity: {
          id: result.rarity.id,
          name: result.rarityNameSnapshot,
          slug: result.rarity.slug,
          displayColor: result.rarity.displayColor,
        },
        previousQuantity: result.previousQuantity,
        newQuantity: result.newQuantity,
        isNew: result.previousQuantity === 0,
      })),
      cost: { amount: Number(row.priceAmount), currencyCode: row.priceCurrency },
      openedAt: row.openedAt?.toISOString() ?? row.createdAt.toISOString(),
    };
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'BOOSTER_NOT_FOUND', message: 'Booster introuvable.' });
  }
}

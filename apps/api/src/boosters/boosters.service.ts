import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';

const weightConfigSchema = z.object({
  entries: z
    .array(
      z.object({
        cardVariantId: z.uuid(),
        weight: z.number().int().min(1).max(1_000_000),
      }),
    )
    .min(1),
});

@Injectable()
export class BoostersService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts() {
    const now = new Date();
    const products = await this.prisma.boosterProduct.findMany({
      where: {
        status: 'published',
        AND: [
          { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
          { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        artworkPath: true,
        priceCurrency: true,
        priceAmount: true,
        cardsPerPack: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((product) => ({
      ...product,
      priceAmount: product.priceAmount.toString(),
    }));
  }

  async openPack(userId: string, productId: string, idempotencyKey: string) {
    const previous = await this.findCompleted(userId, idempotencyKey);
    if (previous) return this.serializeOpening(previous);

    const opening = await this.prisma.runInTransaction(
      async (transaction) => {
        const existing = await transaction.packOpening.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
          include: { cards: { include: { cardVariant: { include: { card: true } } } } },
        });
        if (existing) {
          if (existing.status === 'completed') return existing;
          throw new ConflictException({
            code: 'PACK_OPENING_IN_PROGRESS',
            message: 'Cette ouverture est déjà en cours.',
          });
        }

        const now = new Date();
        const product = await transaction.boosterProduct.findFirst({
          where: {
            id: productId,
            status: 'published',
            AND: [
              { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
              { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
            ],
          },
          include: { slots: { orderBy: { slotIndex: 'asc' } } },
        });
        if (!product) {
          throw new NotFoundException({
            code: 'BOOSTER_PRODUCT_NOT_FOUND',
            message: 'Ce booster est indisponible.',
          });
        }
        if (!product.slots.length) {
          throw new BadRequestException({
            code: 'BOOSTER_NOT_CONFIGURED',
            message: "Ce booster n'a pas encore de configuration de tirage.",
          });
        }

        const wallet = await transaction.wallet.findUnique({
          where: {
            userId_currencyCode: { userId, currencyCode: product.priceCurrency },
          },
        });
        if (!wallet || wallet.balance < product.priceAmount) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_FUNDS',
            message: 'Solde insuffisant pour ouvrir ce booster.',
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
            message: 'Le solde a changé. Réessayez avec une nouvelle requête.',
          });
        }
        const balanceAfter = wallet.balance - product.priceAmount;
        await transaction.currencyTransaction.create({
          data: {
            userId,
            currencyCode: product.priceCurrency,
            amount: -product.priceAmount,
            balanceAfter,
            reason: 'BOOSTER_OPENING',
            referenceType: 'booster_product',
            referenceId: product.id,
            idempotencyKey,
          },
        });
        const created = await transaction.packOpening.create({
          data: {
            userId,
            boosterProductId: product.id,
            idempotencyKey,
            status: 'pending',
            priceCurrency: product.priceCurrency,
            priceAmount: product.priceAmount,
          },
        });

        let drawnCount = 0;
        for (const slot of product.slots) {
          const config = weightConfigSchema.safeParse(slot.weightConfig);
          if (!config.success) {
            throw new BadRequestException({
              code: 'BOOSTER_CONFIGURATION_INVALID',
              message: 'La configuration serveur de ce booster est invalide.',
            });
          }
          for (let index = 0; index < slot.quantity; index += 1) {
            const selected = this.weightedPick(config.data.entries);
            await transaction.packOpeningCard.upsert({
              where: {
                packOpeningId_slotIndex_cardVariantId: {
                  packOpeningId: created.id,
                  cardVariantId: selected.cardVariantId,
                  slotIndex: slot.slotIndex,
                },
              },
              create: {
                packOpeningId: created.id,
                cardVariantId: selected.cardVariantId,
                slotIndex: slot.slotIndex,
                probabilityData: { weight: selected.weight },
              },
              update: { quantity: { increment: 1 } },
            });
            await transaction.userCard.upsert({
              where: {
                userId_cardVariantId: { userId, cardVariantId: selected.cardVariantId },
              },
              create: {
                userId,
                cardVariantId: selected.cardVariantId,
                quantity: 1,
              },
              update: {
                quantity: { increment: 1 },
                lastObtainedAt: now,
              },
            });
            drawnCount += 1;
          }
        }
        if (drawnCount !== product.cardsPerPack) {
          throw new BadRequestException({
            code: 'BOOSTER_CONFIGURATION_INVALID',
            message: 'Le nombre de cartes configuré ne correspond pas au produit.',
          });
        }
        return transaction.packOpening.update({
          where: { id: created.id },
          data: { status: 'completed', openedAt: now },
          include: { cards: { include: { cardVariant: { include: { card: true } } } } },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.serializeOpening(opening);
  }

  private weightedPick(entries: Array<{ cardVariantId: string; weight: number }>) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let value = randomInt(total);
    for (const entry of entries) {
      value -= entry.weight;
      if (value < 0) return entry;
    }
    throw new Error('Weighted selection failed');
  }

  private findCompleted(userId: string, idempotencyKey: string) {
    return this.prisma.packOpening.findFirst({
      where: { userId, idempotencyKey, status: 'completed' },
      include: { cards: { include: { cardVariant: { include: { card: true } } } } },
    });
  }

  private serializeOpening(opening: {
    id: string;
    status: string;
    priceCurrency: string;
    priceAmount: bigint;
    openedAt: Date | null;
    cards: unknown[];
  }) {
    return {
      id: opening.id,
      status: opening.status,
      priceCurrency: opening.priceCurrency,
      priceAmount: opening.priceAmount.toString(),
      openedAt: opening.openedAt?.toISOString() ?? null,
      cards: opening.cards,
    };
  }
}

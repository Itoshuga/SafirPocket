import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeckCardInput, DeckCreateInput, DeckUpdateInput } from '@safir/validation';
import { cardRelations, toCard } from '../cards/card.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DecksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const decks = await this.prisma.deck.findMany({
      where: { ownerId: userId },
      include: { cards: { select: { quantity: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      isActive: deck.isActive,
      visibility: deck.visibility,
      format: deck.format,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      cardCount: deck.cards.reduce((sum, card) => sum + card.quantity, 0),
      uniqueCardCount: deck.cards.length,
    }));
  }

  create(userId: string, input: DeckCreateInput) {
    return this.prisma.deck.create({ data: { ownerId: userId, ...input } });
  }

  async getOwned(userId: string, id: string) {
    const deck = await this.prisma.deck.findFirst({
      where: { id, ownerId: userId },
      include: {
        cards: {
          include: {
            cardVariant: { include: { card: { include: cardRelations } } },
          },
          orderBy: { cardVariant: { card: { name: 'asc' } } },
        },
      },
    });
    if (!deck)
      throw new NotFoundException({ code: 'DECK_NOT_FOUND', message: 'Deck introuvable.' });
    const cardCount = deck.cards.reduce((sum, card) => sum + card.quantity, 0);
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      isActive: deck.isActive,
      visibility: deck.visibility,
      format: deck.format,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      cardCount,
      uniqueCardCount: deck.cards.length,
      cards: deck.cards.map(({ cardVariant, ...entry }) => ({
        ...entry,
        cardVariant: { ...cardVariant, card: toCard(cardVariant.card) },
      })),
      validation: {
        valid: true,
        warnings:
          cardCount === 0
            ? ['Ce deck est vide. Ajoutez des cartes avant de lancer une partie.']
            : [
                'Le format ouvert ne définit pas encore de contrainte de composition supplémentaire.',
              ],
      },
    };
  }

  async update(userId: string, id: string, input: DeckUpdateInput) {
    await this.assertOwner(userId, id);
    return this.prisma.deck.update({ where: { id }, data: input });
  }

  async remove(userId: string, id: string) {
    await this.prisma.runInTransaction(async (transaction) => {
      const deck = await transaction.deck.findFirst({
        where: { id, ownerId: userId },
        select: { cards: { select: { cardVariantId: true, quantity: true } } },
      });
      if (!deck)
        throw new NotFoundException({ code: 'DECK_NOT_FOUND', message: 'Deck introuvable.' });
      for (const card of deck.cards) {
        await transaction.userCard.update({
          where: { userId_cardVariantId: { userId, cardVariantId: card.cardVariantId } },
          data: { lockedQuantity: { decrement: card.quantity } },
        });
      }
      await transaction.deck.delete({ where: { id } });
    });
    return { deleted: true };
  }

  async addCard(userId: string, deckId: string, input: DeckCardInput) {
    await this.assertOwner(userId, deckId);
    return this.prisma.runInTransaction(
      async (transaction) => {
        const [owned, current] = await Promise.all([
          transaction.userCard.findUnique({
            where: { userId_cardVariantId: { userId, cardVariantId: input.cardVariantId } },
          }),
          transaction.deckCard.findUnique({
            where: { deckId_cardVariantId: { deckId, cardVariantId: input.cardVariantId } },
          }),
        ]);
        const delta = input.quantity - (current?.quantity ?? 0);
        if (!owned || (delta > 0 && owned.quantity - owned.lockedQuantity < delta)) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_CARD_QUANTITY',
            message: "La collection ne contient pas assez d'exemplaires disponibles.",
          });
        }
        const deckCard = await transaction.deckCard.upsert({
          where: { deckId_cardVariantId: { deckId, cardVariantId: input.cardVariantId } },
          create: { deckId, ...input },
          update: { quantity: input.quantity },
        });
        if (delta !== 0) {
          await transaction.userCard.update({
            where: { userId_cardVariantId: { userId, cardVariantId: input.cardVariantId } },
            data: { lockedQuantity: { increment: delta } },
          });
        }
        return deckCard;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async removeCard(userId: string, deckId: string, cardVariantId: string) {
    await this.assertOwner(userId, deckId);
    await this.prisma.runInTransaction(async (transaction) => {
      const current = await transaction.deckCard.findUnique({
        where: { deckId_cardVariantId: { deckId, cardVariantId } },
      });
      if (!current) return;
      await transaction.deckCard.delete({
        where: { deckId_cardVariantId: { deckId, cardVariantId } },
      });
      await transaction.userCard.update({
        where: { userId_cardVariantId: { userId, cardVariantId } },
        data: { lockedQuantity: { decrement: current.quantity } },
      });
    });
    return { deleted: true };
  }

  private async assertOwner(userId: string, id: string): Promise<void> {
    const deck = await this.prisma.deck.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!deck)
      throw new NotFoundException({ code: 'DECK_NOT_FOUND', message: 'Deck introuvable.' });
  }
}

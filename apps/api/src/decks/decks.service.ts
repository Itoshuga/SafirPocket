import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeckCardInput, DeckCreateInput, DeckUpdateInput } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DecksService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.deck.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { cards: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(userId: string, input: DeckCreateInput) {
    return this.prisma.deck.create({ data: { ownerId: userId, ...input } });
  }

  async getOwned(userId: string, id: string) {
    const deck = await this.prisma.deck.findFirst({
      where: { id, ownerId: userId },
      include: { cards: { include: { cardVariant: { include: { card: true } } } } },
    });
    if (!deck)
      throw new NotFoundException({ code: 'DECK_NOT_FOUND', message: 'Deck introuvable.' });
    return deck;
  }

  async update(userId: string, id: string, input: DeckUpdateInput) {
    await this.assertOwner(userId, id);
    return this.prisma.deck.update({ where: { id }, data: input });
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.deck.deleteMany({ where: { id, ownerId: userId } });
    if (!result.count)
      throw new NotFoundException({ code: 'DECK_NOT_FOUND', message: 'Deck introuvable.' });
    return { deleted: true };
  }

  async addCard(userId: string, deckId: string, input: DeckCardInput) {
    await this.assertOwner(userId, deckId);
    const owned = await this.prisma.userCard.findUnique({
      where: { userId_cardVariantId: { userId, cardVariantId: input.cardVariantId } },
    });
    if (!owned || owned.quantity - owned.lockedQuantity < input.quantity) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_CARD_QUANTITY',
        message: "La collection ne contient pas assez d'exemplaires disponibles.",
      });
    }
    return this.prisma.deckCard.upsert({
      where: { deckId_cardVariantId: { deckId, cardVariantId: input.cardVariantId } },
      create: { deckId, ...input },
      update: { quantity: input.quantity },
    });
  }

  async removeCard(userId: string, deckId: string, cardVariantId: string) {
    await this.assertOwner(userId, deckId);
    await this.prisma.deckCard.deleteMany({ where: { deckId, cardVariantId } });
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

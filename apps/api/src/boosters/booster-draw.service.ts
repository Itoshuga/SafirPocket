import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { PackSlotCategory } from '@safir/shared-types';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

@Injectable()
export class BoosterRandomService implements RandomSource {
  nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}

export interface DropRateEntry {
  rarityId: string;
  dropRateBps: number;
}

export interface DrawPoolCard {
  id: string;
  rarityId: string;
}

export interface DrawnBoosterCard<TCard extends DrawPoolCard> {
  slotPosition: number;
  slotCategory: PackSlotCategory;
  card: TCard;
  dropRateBps: number | null;
}

@Injectable()
export class BoosterDrawService {
  constructor(private readonly random: BoosterRandomService) {}

  draw<TCard extends DrawPoolCard>(
    commonCards: readonly TCard[],
    premiumCardsByRarity: ReadonlyMap<string, readonly TCard[]>,
    dropRates: readonly DropRateEntry[],
  ): DrawnBoosterCard<TCard>[] {
    this.assertRates(dropRates);
    if (!commonCards.length) {
      throw new BadRequestException({
        code: 'BOOSTER_HAS_NO_COMMON_CARDS',
        message: 'Ce booster ne contient aucune carte commune disponible.',
      });
    }

    for (const rate of dropRates) {
      if (!premiumCardsByRarity.get(rate.rarityId)?.length) {
        throw new BadRequestException({
          code: 'BOOSTER_RARITY_POOL_EMPTY',
          message: 'Une rareté premium ne contient aucune carte disponible.',
          details: { rarityId: rate.rarityId },
        });
      }
    }

    const cards: DrawnBoosterCard<TCard>[] = [];
    for (let slotPosition = 1; slotPosition <= 6; slotPosition += 1) {
      cards.push({
        slotPosition,
        slotCategory: 'COMMON',
        card: this.pick(commonCards),
        dropRateBps: null,
      });
    }
    for (let slotPosition = 7; slotPosition <= 8; slotPosition += 1) {
      const rate = this.pickRate(dropRates);
      cards.push({
        slotPosition,
        slotCategory: 'PREMIUM',
        card: this.pick(premiumCardsByRarity.get(rate.rarityId)!),
        dropRateBps: rate.dropRateBps,
      });
    }
    return cards;
  }

  assertRates(dropRates: readonly DropRateEntry[], commonRarityId?: string): void {
    if (!dropRates.length || dropRates.some(({ dropRateBps }) => dropRateBps <= 0)) {
      throw new BadRequestException({
        code: 'BOOSTER_DROP_RATES_INCOMPLETE',
        message: 'Configurez au moins une rareté premium avec un taux positif.',
      });
    }
    if (new Set(dropRates.map(({ rarityId }) => rarityId)).size !== dropRates.length) {
      throw new BadRequestException({
        code: 'BOOSTER_INVALID_CONFIGURATION',
        message: 'Une rareté premium est configurée plusieurs fois.',
      });
    }
    if (commonRarityId && dropRates.some(({ rarityId }) => rarityId === commonRarityId)) {
      throw new BadRequestException({
        code: 'BOOSTER_INVALID_CONFIGURATION',
        message: 'La rareté commune garantie ne peut pas être utilisée comme rareté premium.',
      });
    }
    if (dropRates.reduce((total, rate) => total + rate.dropRateBps, 0) !== 10_000) {
      throw new BadRequestException({
        code: 'BOOSTER_DROP_RATES_TOTAL_INVALID',
        message: 'Le total des taux de rareté doit être exactement égal à 100 %.',
      });
    }
  }

  private pickRate(dropRates: readonly DropRateEntry[]): DropRateEntry {
    let value = this.random.nextInt(10_000);
    for (const rate of dropRates) {
      value -= rate.dropRateBps;
      if (value < 0) return rate;
    }
    throw new Error('Weighted rarity selection failed');
  }

  private pick<T>(entries: readonly T[]): T {
    return entries[this.random.nextInt(entries.length)]!;
  }
}

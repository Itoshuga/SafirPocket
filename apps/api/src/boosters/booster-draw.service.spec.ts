import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BoosterDrawService, BoosterRandomService } from './booster-draw.service.js';

class SequenceRandom extends BoosterRandomService {
  constructor(private readonly values: number[]) {
    super();
  }

  override nextInt(maxExclusive: number): number {
    const value = this.values.shift() ?? 0;
    if (value < 0 || value >= maxExclusive) throw new Error(`Invalid test value ${value}`);
    return value;
  }
}

const common = [{ id: 'common', rarityId: 'common' }];
const premium = new Map([
  ['rare', [{ id: 'rare-card', rarityId: 'rare' }]],
  ['epic', [{ id: 'epic-card', rarityId: 'epic' }]],
  ['legendary', [{ id: 'legendary-card', rarityId: 'legendary' }]],
]);
const rates = [
  { rarityId: 'rare', dropRateBps: 7000 },
  { rarityId: 'epic', dropRateBps: 2500 },
  { rarityId: 'legendary', dropRateBps: 500 },
];

describe('BoosterDrawService', () => {
  it('draws six common cards followed by two independent premium cards', () => {
    const service = new BoosterDrawService(
      new SequenceRandom([0, 0, 0, 0, 0, 0, 6999, 0, 9500, 0]),
    );
    const result = service.draw(common, premium, rates);
    expect(result).toHaveLength(8);
    expect(
      result.slice(0, 6).map(({ slotPosition, slotCategory }) => [slotPosition, slotCategory]),
    ).toEqual([
      [1, 'COMMON'],
      [2, 'COMMON'],
      [3, 'COMMON'],
      [4, 'COMMON'],
      [5, 'COMMON'],
      [6, 'COMMON'],
    ]);
    expect(
      result
        .slice(6)
        .map(({ slotPosition, slotCategory, card }) => [slotPosition, slotCategory, card.rarityId]),
    ).toEqual([
      [7, 'PREMIUM', 'rare'],
      [8, 'PREMIUM', 'legendary'],
    ]);
  });

  it.each([6999, 7000, 9499, 9500, 9999])(
    'selects the correct interval at boundary %i',
    (value) => {
      const service = new BoosterDrawService(
        new SequenceRandom([0, 0, 0, 0, 0, 0, value, 0, value, 0]),
      );
      const expected = value < 7000 ? 'rare' : value < 9500 ? 'epic' : 'legendary';
      expect(
        service
          .draw(common, premium, rates)
          .slice(6)
          .map(({ card }) => card.rarityId),
      ).toEqual([expected, expected]);
    },
  );

  it.each([
    [[{ rarityId: 'rare', dropRateBps: 9999 }], 'BOOSTER_DROP_RATES_TOTAL_INVALID'],
    [[{ rarityId: 'rare', dropRateBps: 10001 }], 'BOOSTER_DROP_RATES_TOTAL_INVALID'],
    [[{ rarityId: 'rare', dropRateBps: -1 }], 'BOOSTER_DROP_RATES_INCOMPLETE'],
  ] as const)('rejects invalid rates', (invalidRates, code) => {
    const service = new BoosterDrawService(new SequenceRandom([]));
    try {
      service.draw(common, premium, invalidRates);
      throw new Error('Expected draw to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code }),
      );
    }
  });

  it('rejects the common rarity in premium rates', () => {
    const service = new BoosterDrawService(new SequenceRandom([]));
    expect(() =>
      service.assertRates([{ rarityId: 'common', dropRateBps: 10_000 }], 'common'),
    ).toThrowError(BadRequestException);
  });

  it('rejects empty common and premium pools', () => {
    const service = new BoosterDrawService(new SequenceRandom([]));
    expect(() => service.draw([], premium, rates)).toThrowError(BadRequestException);
    expect(() => service.draw(common, new Map(), rates)).toThrowError(BadRequestException);
  });
});

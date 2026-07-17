import { describe, expect, it } from 'vitest';
import { deckCardSchema, matchActionIntentSchema } from './index.js';

describe('shared validation', () => {
  it('rejects invalid deck quantities', () => {
    expect(
      deckCardSchema.safeParse({ cardVariantId: crypto.randomUUID(), quantity: 0 }).success,
    ).toBe(false);
  });

  it('rejects client-computed match results', () => {
    expect(
      matchActionIntentSchema.safeParse({
        actionId: crypto.randomUUID(),
        matchId: crypto.randomUUID(),
        expectedSequence: 0,
        type: 'DECLARE_VICTORY',
        payload: { winnerId: crypto.randomUUID() },
      }).success,
    ).toBe(false);
  });
});

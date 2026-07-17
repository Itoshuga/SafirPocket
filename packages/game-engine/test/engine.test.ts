import { describe, expect, it } from 'vitest';
import {
  GameRuleError,
  reduceGameState,
  TECHNICAL_RULES_VERSION,
  type GameState,
} from '../src/index.js';

const initialState = (): GameState => ({
  rulesVersion: TECHNICAL_RULES_VERSION,
  sequence: 0,
  phase: 'technical-example',
  activePlayerId: 'player-a',
  players: {
    'player-a': { id: 'player-a', health: 10, deck: ['demo-card'], hand: [] },
    'player-b': { id: 'player-b', health: 10, deck: [], hand: [] },
  },
  winnerId: null,
});

describe('technical game-engine example', () => {
  it('produces a new state without mutating the source', () => {
    const source = initialState();
    const result = reduceGameState(source, { type: 'TECHNICAL_DRAW', playerId: 'player-a' });
    expect(source.players['player-a']?.hand).toEqual([]);
    expect(result.state.players['player-a']?.hand).toEqual(['demo-card']);
    expect(result.events[0]?.type).toBe('CARD_DRAWN');
  });

  it('rejects an action from a player without priority', () => {
    expect(() =>
      reduceGameState(initialState(), { type: 'PASS_PRIORITY', playerId: 'player-b' }),
    ).toThrowError(GameRuleError);
  });
});

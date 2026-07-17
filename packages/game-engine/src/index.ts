import { z } from 'zod';

export const TECHNICAL_RULES_VERSION = 'technical-example/1.0.0' as const;

export interface GamePlayerState {
  id: string;
  health: number;
  deck: string[];
  hand: string[];
}

export interface GameState {
  rulesVersion: string;
  sequence: number;
  phase: 'technical-example' | 'finished';
  activePlayerId: string;
  players: Record<string, GamePlayerState>;
  winnerId: string | null;
}

export type GameAction =
  { type: 'TECHNICAL_DRAW'; playerId: string } | { type: 'PASS_PRIORITY'; playerId: string };

export type GameEvent =
  | { type: 'CARD_DRAWN'; playerId: string; cardId: string }
  | { type: 'PRIORITY_PASSED'; fromPlayerId: string; toPlayerId: string };

export type EffectId = 'DRAW_CARDS' | 'DEAL_DAMAGE' | 'HEAL_TARGET';

export interface EffectDefinition {
  effectId: EffectId;
  version: number;
  params: Record<string, unknown>;
}

export interface EffectContext {
  sourcePlayerId: string;
  targetPlayerId?: string;
}

export interface EffectExecutor {
  execute(state: GameState, effect: EffectDefinition, context: EffectContext): GameState;
}

export interface ActionValidator {
  validate(state: GameState, action: GameAction): void;
}

export interface DeckRules {
  minCards?: number;
  maxCards?: number;
  maxCopiesPerVariant?: number;
}

export class GameRuleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function validateAction(state: GameState, action: GameAction): void {
  if (state.phase === 'finished') {
    throw new GameRuleError('MATCH_FINISHED', 'La partie est terminée.');
  }
  const player = state.players[action.playerId];
  if (!player) {
    throw new GameRuleError('PLAYER_NOT_FOUND', 'Joueur inconnu.');
  }
  if (state.activePlayerId !== action.playerId) {
    throw new GameRuleError('NOT_ACTIVE_PLAYER', "Ce n'est pas la priorité de ce joueur.");
  }
  if (action.type === 'TECHNICAL_DRAW' && player.deck.length === 0) {
    throw new GameRuleError('EMPTY_DECK', 'La pioche technique est vide.');
  }
}

export function reduceGameState(
  state: GameState,
  action: GameAction,
): { state: GameState; events: GameEvent[] } {
  validateAction(state, action);
  const copy = structuredClone(state);

  if (action.type === 'TECHNICAL_DRAW') {
    const player = copy.players[action.playerId];
    const cardId = player?.deck.shift();
    if (!player || !cardId) {
      throw new GameRuleError('EMPTY_DECK', 'La pioche technique est vide.');
    }
    player.hand.push(cardId);
    copy.sequence += 1;
    return { state: copy, events: [{ type: 'CARD_DRAWN', playerId: action.playerId, cardId }] };
  }

  const otherPlayerId = Object.keys(copy.players).find((id) => id !== action.playerId);
  if (!otherPlayerId) {
    throw new GameRuleError('OPPONENT_NOT_FOUND', 'Adversaire introuvable.');
  }
  copy.activePlayerId = otherPlayerId;
  copy.sequence += 1;
  return {
    state: copy,
    events: [{ type: 'PRIORITY_PASSED', fromPlayerId: action.playerId, toPlayerId: otherPlayerId }],
  };
}

const drawParams = z.object({ amount: z.number().int().min(1).max(20) });
const pointsParams = z.object({ amount: z.number().int().min(0).max(10_000) });

export const controlledEffectRegistry: Record<EffectId, EffectExecutor> = {
  DRAW_CARDS: {
    execute(state, effect, context) {
      const { amount } = drawParams.parse(effect.params);
      let result = state;
      for (let index = 0; index < amount; index += 1) {
        result = reduceGameState(result, {
          type: 'TECHNICAL_DRAW',
          playerId: context.sourcePlayerId,
        }).state;
      }
      return result;
    },
  },
  DEAL_DAMAGE: {
    execute(state, effect, context) {
      const { amount } = pointsParams.parse(effect.params);
      if (!context.targetPlayerId || !state.players[context.targetPlayerId]) {
        throw new GameRuleError('INVALID_TARGET', 'Cible invalide.');
      }
      const copy = structuredClone(state);
      copy.players[context.targetPlayerId]!.health -= amount;
      return copy;
    },
  },
  HEAL_TARGET: {
    execute(state, effect, context) {
      const { amount } = pointsParams.parse(effect.params);
      if (!context.targetPlayerId || !state.players[context.targetPlayerId]) {
        throw new GameRuleError('INVALID_TARGET', 'Cible invalide.');
      }
      const copy = structuredClone(state);
      copy.players[context.targetPlayerId]!.health += amount;
      return copy;
    },
  },
};

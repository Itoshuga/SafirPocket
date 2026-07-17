import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GameRuleError,
  reduceGameState,
  TECHNICAL_RULES_VERSION,
  type GameAction,
  type GameState,
} from '@safir/game-engine';
import type { MatchActionIntent, MatchSnapshot } from '@safir/shared-types';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  createMatch(
    first: { userId: string; deckId: string },
    second: { userId: string; deckId: string },
    format: string,
  ): Promise<CreatedMatch> {
    const state: GameState = {
      rulesVersion: TECHNICAL_RULES_VERSION,
      sequence: 0,
      phase: 'technical-example',
      activePlayerId: first.userId,
      players: {
        [first.userId]: { id: first.userId, health: 1, deck: [], hand: [] },
        [second.userId]: { id: second.userId, health: 1, deck: [], hand: [] },
      },
      winnerId: null,
    };
    return this.prisma.match.create({
      data: {
        status: 'pending',
        format,
        rulesVersion: TECHNICAL_RULES_VERSION,
        state: state as unknown as Prisma.InputJsonValue,
        players: {
          create: [
            { userId: first.userId, deckId: first.deckId, seat: 0 },
            { userId: second.userId, deckId: second.deckId, seat: 1 },
          ],
        },
      },
      include: { players: { include: { user: true } } },
    });
  }

  async activeFor(userId: string) {
    return this.prisma.match.findMany({
      where: { status: { in: ['pending', 'active'] }, players: { some: { userId } } },
      select: { id: true, state: true, currentSequence: true, rulesVersion: true, status: true },
    });
  }

  async snapshot(matchId: string, userId: string): Promise<MatchSnapshot> {
    const match = await this.getParticipantMatch(matchId, userId);
    return {
      matchId: match.id,
      sequence: match.currentSequence,
      rulesVersion: match.rulesVersion,
      phase: match.status,
      activePlayerId: this.readState(match.state).activePlayerId,
      state: match.state as unknown as Record<string, unknown>,
    };
  }

  async ready(matchId: string, userId: string) {
    await this.getParticipantMatch(matchId, userId);
    await this.prisma.matchPlayer.update({
      where: { matchId_userId: { matchId, userId } },
      data: { isReady: true },
    });
    const readyCount = await this.prisma.matchPlayer.count({ where: { matchId, isReady: true } });
    if (readyCount === 2) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: 'active', startedAt: new Date() },
      });
    }
    return this.snapshot(matchId, userId);
  }

  async applyIntent(userId: string, intent: MatchActionIntent) {
    return this.prisma.runInTransaction(async (transaction) => {
      const match = await transaction.match.findFirst({
        where: { id: intent.matchId, status: 'active', players: { some: { userId } } },
      });
      if (!match)
        throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: 'Partie introuvable.' });
      if (match.currentSequence !== intent.expectedSequence) {
        throw new GameRuleError('SEQUENCE_MISMATCH', 'Une resynchronisation est nécessaire.');
      }
      if (intent.type === 'PLAY_CARD') {
        throw new GameRuleError(
          'RULE_NOT_IMPLEMENTED',
          'Les règles officielles permettant de jouer une carte ne sont pas encore configurées.',
        );
      }
      const action: GameAction =
        intent.type === 'TECHNICAL_DRAW'
          ? { type: 'TECHNICAL_DRAW', playerId: userId }
          : { type: 'PASS_PRIORITY', playerId: userId };
      const result = reduceGameState(this.readState(match.state), action);
      const sequence = match.currentSequence + 1;
      await transaction.matchEvent.create({
        data: {
          matchId: match.id,
          sequence,
          actorId: userId,
          eventType: result.events[0]?.type ?? 'UNKNOWN',
          payload: result.events,
          rulesVersion: match.rulesVersion,
        },
      });
      await transaction.match.update({
        where: { id: match.id },
        data: {
          state: result.state as unknown as Prisma.InputJsonValue,
          currentSequence: sequence,
        },
      });
      return { matchId: match.id, sequence, events: result.events, state: result.state };
    });
  }

  async forfeit(matchId: string, userId: string) {
    const match = await this.getParticipantMatch(matchId, userId);
    const winner = match.players.find((player: { userId: string }) => player.userId !== userId);
    if (!winner)
      throw new NotFoundException({
        code: 'OPPONENT_NOT_FOUND',
        message: 'Adversaire introuvable.',
      });
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'completed',
        winnerId: winner.userId,
        resultReason: 'forfeit',
        finishedAt: new Date(),
      },
    });
    return { matchId, winnerId: winner.userId };
  }

  private async getParticipantMatch(matchId: string, userId: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, players: { some: { userId } } },
      include: { players: true },
    });
    if (!match)
      throw new NotFoundException({ code: 'MATCH_NOT_FOUND', message: 'Partie introuvable.' });
    return match;
  }

  private readState(value: unknown): GameState {
    if (!value || typeof value !== 'object')
      throw new GameRuleError('INVALID_STATE', 'État de partie invalide.');
    return value as GameState;
  }
}

type CreatedMatch = Prisma.MatchGetPayload<{
  include: { players: { include: { user: true } } };
}>;

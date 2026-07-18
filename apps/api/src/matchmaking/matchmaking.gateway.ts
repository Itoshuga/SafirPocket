import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  ClientToServerEvents,
  MatchActionIntent,
  ServerToClientEvents,
  SocketError,
} from '@safir/shared-types';
import {
  matchActionIntentSchema,
  matchReadySchema,
  matchReferenceSchema,
  matchResyncSchema,
  queueJoinSchema,
  queueLeaveSchema,
} from '@safir/validation';
import type { Server, Socket } from 'socket.io';
import { AccountAccessService } from '../auth/account-access.service.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { JwtVerifierService } from '../auth/jwt-verifier.service.js';
import { parseInput } from '../common/errors/zod.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { MATCHMAKING_QUEUE, type MatchmakingQueue, type QueueEntry } from './matchmaking-queue.js';

interface SocketData {
  user: AuthenticatedUser;
}

type MatchSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

@WebSocketGateway({ namespace: '/match', cors: false, transports: ['websocket', 'polling'] })
export class MatchmakingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

  constructor(
    @Inject(JwtVerifierService) private readonly verifier: JwtVerifierService,
    @Inject(AccountAccessService) private readonly accountAccess: AccountAccessService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MatchesService) private readonly matches: MatchesService,
    @Inject(MATCHMAKING_QUEUE) private readonly queue: MatchmakingQueue,
  ) {}

  async handleConnection(client: MatchSocket): Promise<void> {
    const token = this.readToken(client);
    if (!token) return this.reject(client, 'AUTHENTICATION_REQUIRED', 'Authentification requise.');
    try {
      client.data.user = await this.accountAccess.authenticate(await this.verifier.verify(token));
      const activeMatches = await this.matches.activeFor(client.data.user.id);
      for (const match of activeMatches) {
        await client.join(this.room(match.id));
        client.emit('match:state', {
          matchId: match.id,
          sequence: match.currentSequence,
          rulesVersion: match.rulesVersion,
          phase: match.status,
          activePlayerId: null,
          state: match.state as unknown as Record<string, unknown>,
        });
      }
    } catch (error) {
      const payload = this.errorPayload(error, 'connection');
      this.reject(client, payload.code, payload.message);
    }
  }

  handleDisconnect(client: MatchSocket): void {
    this.queue.removeSocket(client.id);
  }

  @SubscribeMessage('queue:join')
  async joinQueue(@ConnectedSocket() client: MatchSocket, @MessageBody() payload: unknown) {
    try {
      await this.refreshAccount(client);
      const input = parseInput(queueJoinSchema, payload);
      const deck = await this.prisma.deck.findFirst({
        where: { id: input.deckId, ownerId: client.data.user.id },
        select: { id: true },
      });
      if (!deck) return this.emitError(client, 'DECK_NOT_FOUND', 'Deck introuvable.', 'queue:join');
      const entry: QueueEntry = {
        userId: client.data.user.id,
        deckId: input.deckId,
        socketId: client.id,
        format: input.format,
        joinedAt: new Date(),
      };
      const opponent = this.queue.join(entry);
      client.emit('queue:joined', { format: input.format, joinedAt: entry.joinedAt.toISOString() });
      if (opponent) await this.createSocketMatch(entry, opponent);
    } catch (error) {
      this.handleError(client, error, 'queue:join');
    }
  }

  @SubscribeMessage('queue:leave')
  async leaveQueue(@ConnectedSocket() client: MatchSocket, @MessageBody() payload: unknown) {
    try {
      await this.refreshAccount(client);
      const input = parseInput(queueLeaveSchema, payload);
      this.queue.leave(client.data.user.id, input.format);
      client.emit('queue:left', { format: input.format });
    } catch (error) {
      this.handleError(client, error, 'queue:leave');
    }
  }

  @SubscribeMessage('match:ready')
  async ready(@ConnectedSocket() client: MatchSocket, @MessageBody() payload: unknown) {
    try {
      await this.refreshAccount(client);
      const input = parseInput(matchReadySchema, payload);
      const state = await this.matches.ready(input.matchId, client.data.user.id);
      this.server.to(this.room(input.matchId)).emit('match:state', state);
    } catch (error) {
      this.handleError(client, error, 'match:ready');
    }
  }

  @SubscribeMessage('match:action')
  async action(@ConnectedSocket() client: MatchSocket, @MessageBody() payload: unknown) {
    try {
      await this.refreshAccount(client);
      const intent = parseInput(matchActionIntentSchema, payload) as MatchActionIntent;
      const result = await this.matches.applyIntent(client.data.user.id, intent);
      this.server.to(this.room(intent.matchId)).emit('match:event', {
        matchId: intent.matchId,
        sequence: result.sequence,
        event: { events: result.events },
      });
      this.server.to(this.room(intent.matchId)).emit('match:state', {
        matchId: intent.matchId,
        sequence: result.sequence,
        rulesVersion: result.state.rulesVersion,
        phase: result.state.phase,
        activePlayerId: result.state.activePlayerId,
        state: result.state as unknown as Record<string, unknown>,
      });
    } catch (error) {
      this.handleError(client, error, 'match:action');
    }
  }

  @SubscribeMessage('match:resync')
  async resync(@ConnectedSocket() client: MatchSocket, @MessageBody() payload: unknown) {
    try {
      await this.refreshAccount(client);
      const input = parseInput(matchResyncSchema, payload);
      client.emit('match:state', await this.matches.snapshot(input.matchId, client.data.user.id));
    } catch (error) {
      this.handleError(client, error, 'match:resync');
    }
  }

  @SubscribeMessage('match:forfeit')
  async forfeit(@ConnectedSocket() client: MatchSocket, @MessageBody() payload: unknown) {
    try {
      await this.refreshAccount(client);
      const input = parseInput(matchReferenceSchema, payload);
      const result = await this.matches.forfeit(input.matchId, client.data.user.id);
      this.server.to(this.room(input.matchId)).emit('match:finished', {
        matchId: input.matchId,
        result: result.winnerId === client.data.user.id ? 'win' : 'loss',
      });
    } catch (error) {
      this.handleError(client, error, 'match:forfeit');
    }
  }

  private async createSocketMatch(first: QueueEntry, second: QueueEntry): Promise<void> {
    const match = await this.matches.createMatch(first, second, first.format);
    const room = this.room(match.id);
    this.server.in([first.socketId, second.socketId]).socketsJoin(room);
    const firstProfile = match.players.find(
      (player: { userId: string }) => player.userId === first.userId,
    )?.user;
    const secondProfile = match.players.find(
      (player: { userId: string }) => player.userId === second.userId,
    )?.user;
    if (firstProfile && secondProfile) {
      this.server.to(first.socketId).emit('match:found', {
        matchId: match.id,
        opponent: this.publicProfile(secondProfile),
      });
      this.server.to(second.socketId).emit('match:found', {
        matchId: match.id,
        opponent: this.publicProfile(firstProfile),
      });
    }
  }

  private publicProfile(profile: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    role: 'USER' | 'PIONEER' | 'MODERATOR' | 'ADMINISTRATOR';
  }) {
    return profile;
  }

  private readToken(client: MatchSocket): string | null {
    const authToken = client.handshake.auth.token;
    if (typeof authToken === 'string') return authToken.replace(/^Bearer\s+/i, '');
    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  }

  private room(matchId: string): string {
    return `match:${matchId}`;
  }

  private reject(client: MatchSocket, code: string, message: string): void {
    client.emit('match:error', { code, message });
    client.disconnect(true);
  }

  private async refreshAccount(client: MatchSocket): Promise<void> {
    client.data.user = await this.accountAccess.ensureActive(
      client.data.user.id,
      client.data.user.email,
    );
  }

  private emitError(client: MatchSocket, code: string, message: string, event: string): void {
    client.emit('match:error', { code, message, event });
  }

  private handleError(client: MatchSocket, error: unknown, event: string): void {
    client.emit('match:error', this.errorPayload(error, event));
  }

  private errorPayload(error: unknown, event: string): SocketError {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      response?: { code?: unknown; message?: unknown };
    };
    return {
      code:
        typeof candidate.response?.code === 'string'
          ? candidate.response.code
          : typeof candidate.code === 'string'
            ? candidate.code
            : 'MATCH_ERROR',
      message:
        typeof candidate.response?.message === 'string'
          ? candidate.response.message
          : typeof candidate.message === 'string'
            ? candidate.message
            : 'Action impossible.',
      event,
    };
  }
}

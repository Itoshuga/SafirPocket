import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MatchmakingGateway } from './matchmaking.gateway.js';

describe('MatchmakingGateway account access', () => {
  it('disconnects a suspended account before it can use Socket.IO', async () => {
    const verifier = {
      verify: vi.fn().mockResolvedValue({ id: crypto.randomUUID(), email: 'user@example.com' }),
    };
    const accountAccess = {
      authenticate: vi.fn().mockRejectedValue(
        new ForbiddenException({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Ce compte est actuellement suspendu.',
        }),
      ),
    };
    const gateway = new MatchmakingGateway(
      verifier as never,
      accountAccess as never,
      {} as never,
      { activeFor: vi.fn() } as never,
      { removeSocket: vi.fn() } as never,
    );
    const client = {
      id: 'socket-1',
      data: {},
      handshake: { auth: { token: 'valid-token' }, headers: {} },
      emit: vi.fn(),
      disconnect: vi.fn(),
      join: vi.fn(),
    };

    await gateway.handleConnection(client as never);

    expect(client.emit).toHaveBeenCalledWith('match:error', {
      code: 'ACCOUNT_SUSPENDED',
      message: 'Ce compte est actuellement suspendu.',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});

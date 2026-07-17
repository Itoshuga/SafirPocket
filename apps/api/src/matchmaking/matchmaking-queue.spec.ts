import { describe, expect, it } from 'vitest';
import { InMemoryMatchmakingQueue } from './matchmaking-queue.js';

describe('InMemoryMatchmakingQueue', () => {
  it('pairs two distinct players of the same format', () => {
    const queue = new InMemoryMatchmakingQueue();
    const first = {
      userId: 'a',
      deckId: 'deck-a',
      socketId: 'socket-a',
      format: 'open',
      joinedAt: new Date(),
    };
    expect(queue.join(first)).toBeNull();
    expect(
      queue.join({
        userId: 'b',
        deckId: 'deck-b',
        socketId: 'socket-b',
        format: 'open',
        joinedAt: new Date(),
      }),
    ).toEqual(first);
  });
});

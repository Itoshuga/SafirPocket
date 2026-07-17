export interface QueueEntry {
  userId: string;
  deckId: string;
  socketId: string;
  format: string;
  joinedAt: Date;
}

export interface MatchmakingQueue {
  join(entry: QueueEntry): QueueEntry | null;
  leave(userId: string, format?: string): boolean;
  removeSocket(socketId: string): void;
}

export const MATCHMAKING_QUEUE = Symbol('MATCHMAKING_QUEUE');

export class InMemoryMatchmakingQueue implements MatchmakingQueue {
  private readonly entries = new Map<string, QueueEntry>();

  join(entry: QueueEntry): QueueEntry | null {
    this.leave(entry.userId);
    const opponent = [...this.entries.values()].find(
      (candidate) => candidate.format === entry.format && candidate.userId !== entry.userId,
    );
    if (opponent) {
      this.entries.delete(opponent.userId);
      return opponent;
    }
    this.entries.set(entry.userId, entry);
    return null;
  }

  leave(userId: string, format?: string): boolean {
    const entry = this.entries.get(userId);
    if (!entry || (format && entry.format !== format)) return false;
    return this.entries.delete(userId);
  }

  removeSocket(socketId: string): void {
    for (const [userId, entry] of this.entries.entries()) {
      if (entry.socketId === socketId) this.entries.delete(userId);
    }
  }
}

import { describe, expect, it, vi } from 'vitest';
import { RankingsService } from './rankings.service.js';

describe('RankingsService', () => {
  it('returns stable global ranks for a paginated season', async () => {
    const season = {
      id: crypto.randomUUID(),
      slug: 's1',
      name: 'Saison 1',
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2027-01-01'),
    };
    const rating = {
      rating: 1200,
      wins: 4,
      losses: 2,
      draws: 1,
      user: {
        id: crypto.randomUUID(),
        username: 'joueur',
        displayName: null,
        avatarPath: null,
        bio: null,
        role: 'user',
      },
    };
    const prisma = {
      rankedSeason: { findFirst: vi.fn().mockResolvedValue(season) },
      rankedRating: {
        findMany: vi.fn().mockResolvedValue([rating]),
        count: vi.fn().mockResolvedValue(26),
      },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    };
    const service = new RankingsService(prisma as never);
    const result = await service.leaderboard({ page: 2, pageSize: 25 });
    expect(result.data[0]).toEqual({ ...rating, rank: 26 });
    expect(result.pagination).toEqual({ page: 2, pageSize: 25, total: 26, pageCount: 2 });
  });

  it('returns an explicit empty state when no season exists', async () => {
    const prisma = { rankedSeason: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new RankingsService(prisma as never);
    const result = await service.leaderboard({ page: 1, pageSize: 25 });
    expect(result.season).toBeNull();
    expect(result.data).toEqual([]);
  });
});

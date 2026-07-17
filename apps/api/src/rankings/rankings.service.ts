import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  leaderboard(seasonId: string) {
    return this.prisma.rankedRating.findMany({
      where: { seasonId },
      include: { user: true },
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }],
      take: 100,
    });
  }
}

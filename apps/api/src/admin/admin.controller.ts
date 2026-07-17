import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/auth/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Roles('admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('status')
  status() {
    return { status: 'ready', message: "Fondation d'administration active." };
  }

  @Get('overview')
  async overview() {
    const [publishedSets, publishedCards, publishedBoosters, activeMatches, profiles] =
      await Promise.all([
        this.prisma.cardSet.count({ where: { status: 'published' } }),
        this.prisma.card.count({ where: { status: 'published' } }),
        this.prisma.boosterProduct.count({ where: { status: 'published' } }),
        this.prisma.match.count({ where: { status: 'active' } }),
        this.prisma.profile.count(),
      ]);
    return {
      status: 'ready' as const,
      counts: { publishedSets, publishedCards, publishedBoosters, activeMatches, profiles },
      generatedAt: new Date().toISOString(),
    };
  }
}

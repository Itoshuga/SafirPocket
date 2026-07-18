import { Controller, Get, Query } from '@nestjs/common';
import { adminAuditQuerySchema } from '@safir/validation';
import { Permissions } from '../common/auth/permissions.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Permissions('ADMIN_ACCESS')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('status')
  status() {
    return { status: 'ready', message: "Fondation d'administration active." };
  }

  @Get('overview')
  async overview() {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      pioneers,
      cards,
      rarities,
      seasons,
      types,
      recentActions,
    ] = await Promise.all([
      this.prisma.userProfile.count(),
      this.prisma.userProfile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.userProfile.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.userProfile.count({ where: { status: 'BANNED' } }),
      this.prisma.userProfile.count({ where: { role: 'PIONEER' } }),
      this.prisma.card.count({ where: { deletedAt: null } }),
      this.prisma.cardRarity.count({ where: { deletedAt: null } }),
      this.prisma.cardSeason.count({ where: { deletedAt: null } }),
      this.prisma.cardType.count({ where: { deletedAt: null } }),
      this.prisma.adminAuditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, username: true, displayName: true } } },
      }),
    ]);
    return {
      status: 'ready' as const,
      counts: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        bannedUsers,
        pioneers,
        cards,
        rarities,
        seasons,
        types,
      },
      recentActions: recentActions.map((action) => ({
        ...action,
        createdAt: action.createdAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  @Permissions('AUDIT_LOGS_READ')
  @Get('audit-logs')
  async auditLogs(@Query() query: unknown) {
    const input = parseInput(adminAuditQuerySchema, query);
    const where = input.entityType ? { entityType: input.entityType } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        where,
        include: { actor: { select: { id: true, username: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return {
      data: data.map((action) => ({ ...action, createdAt: action.createdAt.toISOString() })),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        pageCount: Math.ceil(total / input.pageSize),
      },
    };
  }
}

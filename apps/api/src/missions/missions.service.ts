import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  activeFor(userId: string) {
    return this.prisma.userMission.findMany({
      where: { userId, status: { in: ['active', 'completed'] } },
      include: { mission: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userCard.findMany({
      where: { userId },
      include: { cardVariant: { include: { card: { include: { set: true } } } } },
      orderBy: { lastObtainedAt: 'desc' },
    });
  }
}

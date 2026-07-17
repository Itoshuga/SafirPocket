import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  wallets(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId },
      select: { currencyCode: true, balance: true, updatedAt: true },
    });
  }
}

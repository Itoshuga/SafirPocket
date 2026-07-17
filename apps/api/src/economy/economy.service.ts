import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  async wallets(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: { currencyCode: true, balance: true, updatedAt: true },
    });
    return wallets.map((wallet) => ({ ...wallet, balance: wallet.balance.toString() }));
  }
}

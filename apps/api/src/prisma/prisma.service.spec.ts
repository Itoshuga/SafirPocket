import { describe, expect, it, vi } from 'vitest';
import { PrismaService, type PrismaTransactionClient } from './prisma.service.js';

describe('PrismaService', () => {
  it('keeps the Prisma client context for interactive transactions', async () => {
    const service = Object.create(PrismaService.prototype) as PrismaService;
    const transactionClient = { cardRarity: { count: vi.fn().mockResolvedValue(2) } };
    const transaction = vi.fn(function (
      this: PrismaService,
      callback: (client: PrismaTransactionClient) => Promise<unknown>,
    ) {
      expect(this).toBe(service);
      return callback(transactionClient as unknown as PrismaTransactionClient);
    });
    Object.defineProperty(service, '$transaction', { value: transaction });

    await expect(service.runInTransaction((client) => client.cardRarity.count())).resolves.toBe(2);
    expect(transaction).toHaveBeenCalledOnce();
  });
});

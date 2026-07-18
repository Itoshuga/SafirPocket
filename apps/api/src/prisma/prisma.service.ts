import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: config.get<string>('NODE_ENV') === 'production' ? 15 : 5,
      application_name: 'safir-pocket-api',
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }

  runInTransaction<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    // Prisma 7's generated interactive-transaction type loses model delegates when
    // PrismaClient is subclassed. Keep the cast isolated in this adapter boundary.
    const transaction = this.$transaction.bind(this) as unknown as (
      callback: (client: PrismaTransactionClient) => Promise<T>,
      settings?: typeof options,
    ) => Promise<T>;
    return transaction(work, options);
  }
}

export type PrismaTransactionClient = Omit<
  PrismaService,
  | '$connect'
  | '$disconnect'
  | '$on'
  | '$transaction'
  | '$extends'
  | 'onModuleInit'
  | 'onModuleDestroy'
  | 'runInTransaction'
>;

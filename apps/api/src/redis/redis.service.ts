import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor(
    config: ConfigService,
    private readonly logger: Logger,
  ) {
    this.client = createClient({ url: config.getOrThrow<string>('REDIS_URL') });
    this.client.on('error', (error: Error) => {
      this.logger.warn(
        { err: error },
        'Redis indisponible; les services locaux restent en mémoire',
      );
    });
  }

  async connect(): Promise<boolean> {
    if (this.client.isReady) return true;
    try {
      await this.client.connect();
      return true;
    } catch {
      return false;
    }
  }

  get connection(): RedisClientType {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }
}

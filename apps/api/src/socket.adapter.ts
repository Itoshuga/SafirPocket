import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

export class SafirSocketAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly webOrigins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Partial<ServerOptions>) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.webOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
      },
    });
  }
}

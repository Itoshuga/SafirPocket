import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/errors/http-exception.filter.js';
import { SafirSocketAdapter } from './socket.adapter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  const webOrigin = config.getOrThrow<string>('WEB_ORIGIN');

  app.useLogger(logger);
  app.use(helmet());
  app.enableCors({
    origin: [webOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
  });
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.useWebSocketAdapter(new SafirSocketAdapter(app, webOrigin));
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('API_PORT');
  await app.listen(port, '0.0.0.0');
  logger.log(`Safir Pocket API listening on http://localhost:${port}`);
}

void bootstrap();

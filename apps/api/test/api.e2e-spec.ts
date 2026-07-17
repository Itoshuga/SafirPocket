import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { HealthController } from '../src/health/health.controller.js';

@Controller('api/v1/me/collection')
class ProtectedCollectionController {
  @Get()
  list() {
    return [];
  }
}

describe('API HTTP boundaries', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController, ProtectedCollectionController],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards({
      canActivate(context) {
        const requestObject = context
          .switchToHttp()
          .getRequest<{ url: string; headers: Record<string, string> }>();
        return requestObject.url === '/health' || Boolean(requestObject.headers.authorization);
      },
    });
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /health responds', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('refuses a collection without authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/collection').expect(403);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// Needs the local infra running: npm run infra:up
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → all services up', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        services: { postgres: 'up', mongo: 'up', redis: 'up' },
      });
  });

  it('GET /v1/auth/me without a token → 401', () => {
    return request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });

  it('GET /v1/api-keys/current without a key → 401', () => {
    return request(app.getHttpServer()).get('/v1/api-keys/current').expect(401);
  });
});

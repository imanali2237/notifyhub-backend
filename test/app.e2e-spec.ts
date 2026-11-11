import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { buildSwaggerDocument } from './../src/common/swagger/swagger.setup.js';

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

  it('POST /v1/events/trigger without a key → 401', () => {
    return request(app.getHttpServer())
      .post('/v1/events/trigger')
      .send({})
      .expect(401);
  });

  it('POST /v1/email/send without a key → 401', () => {
    return request(app.getHttpServer())
      .post('/v1/email/send')
      .send({})
      .expect(401);
  });

  it('Swagger documents every route with the right auth scheme', () => {
    const doc = buildSwaggerDocument(app);
    const security = (path: string, method: string) =>
      (doc.paths[path] as Record<string, { security?: object[] }>)[method]
        ?.security;

    expect(Object.keys(doc.paths).sort()).toEqual([
      '/health',
      '/v1/api-keys',
      '/v1/api-keys/current',
      '/v1/api-keys/{id}',
      '/v1/auth/login',
      '/v1/auth/me',
      '/v1/auth/resend-otp',
      '/v1/auth/signup',
      '/v1/auth/verify-email',
      '/v1/email/send',
      '/v1/events/trigger',
      '/v1/in-app/send',
      '/v1/inbox/messages',
      '/v1/inbox/messages/{id}/read',
      '/v1/inbox/read-all',
      '/v1/inbox/tokens',
      '/v1/inbox/unread-count',
      '/v1/notifications/{id}',
    ]);
    expect(security('/v1/events/trigger', 'post')).toEqual([{ 'api-key': [] }]);
    expect(security('/v1/email/send', 'post')).toEqual([{ 'api-key': [] }]);
    expect(security('/v1/in-app/send', 'post')).toEqual([{ 'api-key': [] }]);
    expect(security('/v1/inbox/tokens', 'post')).toEqual([{ 'api-key': [] }]);
    expect(security('/v1/inbox/messages', 'get')).toEqual([
      { 'subscriber-token': [] },
    ]);
    expect(security('/v1/api-keys', 'post')).toEqual([{ jwt: [] }]);
    expect(security('/v1/auth/login', 'post')).toBeUndefined();
  });

  it('GET /v1/api-keys/current without a key → 401', () => {
    return request(app.getHttpServer()).get('/v1/api-keys/current').expect(401);
  });
});

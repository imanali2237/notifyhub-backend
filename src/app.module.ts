import { Module } from '@nestjs/common';
import { ApiKeysModule } from './api-keys/api-keys.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { MongoModule } from './database/mongo.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { InboxApiModule } from './inbox/inbox-api.module.js';
import { NotificationsApiModule } from './notifications/notifications-api.module.js';
import { RedisModule } from './redis/redis.module.js';

/** Root module of the API process (main.ts). The worker has its own: WorkerModule. */
@Module({
  imports: [
    // ── Infrastructure ──
    AppConfigModule, // .env, validated with zod
    PrismaModule, // PostgreSQL (config data)
    MongoModule, // MongoDB (notification logs)
    RedisModule, // Redis (OTPs, idempotency, rate limits)

    // ── Features ──
    HealthModule, // GET /health
    AuthModule, // signup, email OTP, login (JWT)
    ApiKeysModule, // dashboard manages keys (JWT), SDK uses them (x-api-key)
    EventsModule, // POST /v1/events/trigger, /v1/email/send → queue
    NotificationsApiModule, // GET /v1/notifications/:id
    InboxApiModule, // in-app inbox: subscriber tokens, inbox API, WebSocket
  ],
})
export class AppModule {}

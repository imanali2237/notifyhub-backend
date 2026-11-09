import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeysModule } from './api-keys/api-keys.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv, type Env } from './config/env.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    // ── Infrastructure ──
    // Loads .env, validates it with zod, and makes ConfigService available everywhere.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    // PostgreSQL (config data) via Prisma
    PrismaModule,

    // MongoDB (logs + in-app feed) via Mongoose
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGO_URI'),
      }),
    }),

    // Redis (OTPs, idempotency, rate limits)
    RedisModule,

    // ── Features ──
    HealthModule, // GET /health
    AuthModule, // signup, email OTP, login (JWT)
    ApiKeysModule, // dashboard manages keys (JWT), SDK uses them (x-api-key)
  ],
})
export class AppModule {}

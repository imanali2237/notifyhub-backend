import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv, type Env } from './config/env.js';
import { PrismaModule } from './database/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
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

    // Redis (idempotency, rate limits)
    RedisModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

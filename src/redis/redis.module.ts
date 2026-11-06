import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';

/** Injection token: `constructor(@Inject(REDIS) private redis: Redis) {}` */
export const REDIS = Symbol('REDIS');

/**
 * Shared Redis connection for idempotency keys, rate limiting, etc.
 * (BullMQ will get its own connections later — it needs blocking commands.)
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('Redis');
        const client = new Redis({
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
        });
        client.on('ready', () => logger.log('Connected to Redis'));
        client.on('error', (err) => logger.error(err.message));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}

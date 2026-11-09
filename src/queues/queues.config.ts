import type { ConfigService } from '@nestjs/config';
import type { DefaultJobOptions } from 'bullmq';
import type { Env } from '../config/env.js';

/** Default options for jobs in every channel queue, from .env (QUEUE_*). */
export function buildJobOptions(
  config: ConfigService<Env, true>,
): DefaultJobOptions {
  return {
    attempts: config.get('QUEUE_MAX_ATTEMPTS'),
    // Exponential: delay, 2×delay, 4×delay... (2s, 4s, 8s, 16s by default)
    backoff: {
      type: 'exponential',
      delay: config.get('QUEUE_BACKOFF_DELAY_MS'),
    },
    // Keep Redis small: forget successful jobs (Mongo has the real log)...
    removeOnComplete: {
      age: config.get('QUEUE_KEEP_COMPLETED_SECONDS'),
      count: config.get('QUEUE_KEEP_COMPLETED_COUNT'),
    },
    // ...but keep failed jobs longer. This "failed" set is our dead letter queue:
    // inspect and retry them later (e.g. from Bull Board).
    removeOnFail: { age: config.get('QUEUE_KEEP_FAILED_SECONDS') },
  };
}

/** BullMQ's Redis connection, from the same REDIS_* settings as the shared client. */
export function buildRedisConnection(config: ConfigService<Env, true>) {
  return {
    host: config.get('REDIS_HOST'),
    port: config.get('REDIS_PORT'),
    password: config.get('REDIS_PASSWORD', { infer: true }),
  };
}

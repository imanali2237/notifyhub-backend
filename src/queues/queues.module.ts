import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHANNEL_QUEUES, CHANNELS } from '../channels/channels.constants.js';
import type { Env } from '../config/env.js';
import { NotificationQueueService } from './notification-queue.service.js';
import { buildJobOptions, buildRedisConnection } from './queues.config.js';

/**
 * BullMQ connection + one queue per channel (created from CHANNELS, so a new
 * channel gets its queue automatically). Settings come from .env (QUEUE_*).
 * Imported by:
 *  - the API, to ADD jobs        (NotificationQueueService)
 *  - the worker, to PROCESS them (@Processor(CHANNEL_QUEUES.x))
 *
 * BullMQ opens its own Redis connections (workers need blocking commands),
 * separate from the shared REDIS client used for OTPs and idempotency.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: buildRedisConnection(config),
      }),
    }),
    BullModule.registerQueueAsync(
      ...CHANNELS.map((channel) => ({
        name: CHANNEL_QUEUES[channel],
        inject: [ConfigService],
        useFactory: (config: ConfigService<Env, true>) => ({
          defaultJobOptions: buildJobOptions(config),
        }),
      })),
    ),
  ],
  providers: [NotificationQueueService],
  exports: [BullModule, NotificationQueueService],
})
export class QueuesModule {}

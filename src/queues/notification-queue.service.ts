import { getQueueToken } from '@nestjs/bullmq';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import type { Queue } from 'bullmq';
import {
  CHANNEL_QUEUES,
  CHANNELS,
  type Channel,
} from '../channels/channels.constants.js';
import { withTimeout } from '../common/utils/with-timeout.js';
import type { Env } from '../config/env.js';
import { SEND_NOTIFICATION_JOB } from './queues.constants.js';
import type { NotificationJobData } from './queues.interfaces.js';

/**
 * The one place the API uses to enqueue work. Callers say "send this on channel X";
 * this service finds the right queue, so no caller ever names a queue directly.
 */
@Injectable()
export class NotificationQueueService implements OnModuleInit {
  private readonly queues = new Map<Channel, Queue<NotificationJobData>>();

  /**
   * Max wait for Redis when adding a job (QUEUE_ENQUEUE_TIMEOUT_MS). If Redis is
   * down, BullMQ would otherwise wait for it and the client's request would hang.
   */
  private readonly enqueueTimeoutMs: number;

  constructor(
    private readonly moduleRef: ModuleRef,
    config: ConfigService<Env, true>,
  ) {
    this.enqueueTimeoutMs = config.get('QUEUE_ENQUEUE_TIMEOUT_MS');
  }

  /**
   * Look the queues up here, not in the constructor: Nest calls onModuleInit only
   * after every provider (including the BullMQ queues) has been created.
   */
  onModuleInit(): void {
    for (const channel of CHANNELS) {
      const queue = this.moduleRef.get<Queue<NotificationJobData>>(
        getQueueToken(CHANNEL_QUEUES[channel]),
        { strict: false },
      );
      if (!queue)
        throw new Error(`Queue for channel "${channel}" not registered`);
      this.queues.set(channel, queue);
    }
  }

  async enqueue(channel: Channel, notificationId: string): Promise<void> {
    const queue = this.queues.get(channel);
    if (!queue) throw new Error(`No queue for channel "${channel}"`);
    // jobId = notificationId → BullMQ won't add the same job twice.
    // If a timed-out add still lands later, the worker finds no notification
    // (it was rolled back) and drops the job — nothing is sent twice.
    await withTimeout(
      queue.add(
        SEND_NOTIFICATION_JOB,
        { notificationId },
        { jobId: notificationId },
      ),
      this.enqueueTimeoutMs,
    );
  }
}

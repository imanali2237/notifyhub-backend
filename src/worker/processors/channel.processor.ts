import { WorkerHost } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { CHANNEL_HANDLERS } from '../../channels/channel-handlers.js';
import {
  CHANNEL_CONCURRENCY_SETTING,
  type Channel,
} from '../../channels/channels.constants.js';
import type { ChannelContent } from '../../channels/channels.interfaces.js';
import type { Env } from '../../config/env.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ProviderRegistry } from '../../providers/provider.registry.js';
import type { NotificationJobData } from '../../queues/queues.interfaces.js';
import { renderTemplates } from '../../templates/template-renderer.js';

/**
 * The full lifecycle of sending ONE notification, for ANY channel:
 *   load → mark processing → render → provider.send → sent / retry / failed
 *
 * Each channel only subclasses this and sets `channel` (see email.processor.ts).
 *
 * Throwing an Error           → BullMQ retries later (exponential backoff).
 * Throwing UnrecoverableError → no more retries, job goes to the failed set (DLQ).
 */
@Injectable()
export abstract class ChannelProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  protected abstract readonly channel: Channel;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly providers: ProviderRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  /**
   * @Processor() options are fixed at compile time, so the concurrency from .env
   * (e.g. EMAIL_WORKER_CONCURRENCY) is applied here, once the worker exists.
   */
  onApplicationBootstrap(): void {
    const concurrency = this.config.get(
      CHANNEL_CONCURRENCY_SETTING[this.channel],
    );
    this.worker.concurrency = concurrency;
    this.logger.log(
      `${this.channel} worker ready (concurrency ${concurrency})`,
    );
  }

  async process(job: Job<NotificationJobData>) {
    const { notificationId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const handler = CHANNEL_HANDLERS[this.channel];

    const notification = await this.notifications.findById(notificationId);
    if (!notification) {
      throw new UnrecoverableError(`Notification ${notificationId} not found`);
    }
    // Already sent (e.g. the job was delivered twice) → don't send it again.
    if (notification.status === 'sent') return { skipped: 'already sent' };

    const fail = async (reason: string): Promise<never> => {
      await this.notifications.markFailed(notificationId, reason);
      this.logger.error(`✗ ${notificationId} failed permanently: ${reason}`);
      throw new UnrecoverableError(reason);
    };

    const address = notification.recipient[handler.recipientField];
    if (!address) return fail(`Recipient has no ${handler.recipientField}`);

    await this.notifications.markProcessing(notificationId, attempt);

    // 1. Render the channel's templates with the payload (+ {{subscriber.*}}).
    let rendered: ChannelContent;
    try {
      rendered = renderTemplates(notification.content, handler.templateFields, {
        ...notification.payload,
        subscriber: notification.recipient,
      });
    } catch (err) {
      return fail(`Template error: ${(err as Error).message}`); // retrying won't fix it
    }

    // 2. Send through the channel's provider.
    const provider = this.providers.resolve(this.channel);
    const result = await provider.send(handler.buildMessage(address, rendered));

    // 3a. Success
    if (result.success) {
      await this.notifications.markSent(
        notificationId,
        provider.id,
        result.providerMessageId,
        rendered,
      );
      this.logger.log(
        `✓ ${this.channel} ${notificationId} sent to ${address} via ${provider.id} (attempt ${attempt})`,
      );
      return {
        provider: provider.id,
        providerMessageId: result.providerMessageId,
      };
    }

    // 3b. Failure: give up, or let BullMQ retry
    const error = result.error ?? 'Unknown provider error';
    if (!result.retryable || attempt >= maxAttempts) return fail(error);

    await this.notifications.markRetrying(notificationId, error, attempt);
    this.logger.warn(
      `↻ ${this.channel} ${notificationId} attempt ${attempt}/${maxAttempts} failed (${error}), retrying`,
    );
    throw new Error(error);
  }
}

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
 * Providers are tried in the operator's order (failover) by ProviderRegistry.
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
    if (this.providers.isEnabled(this.channel)) {
      this.logger.log(
        `${this.channel} worker ready (concurrency ${concurrency})`,
      );
    } else {
      this.logger.warn(
        `${this.channel} channel disabled: no providers configured, leftover jobs will be marked failed`,
      );
    }
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

    // e.g. the operator removed all email providers while jobs were still queued
    if (!this.providers.isEnabled(this.channel)) {
      return fail(`The ${this.channel} channel has no providers configured`);
    }

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

    // 2. Send through the channel's providers, in the operator's failover order.
    const result = await this.providers.send(
      this.channel,
      handler.buildMessage(address, rendered, {
        notificationId,
        tenantId: notification.tenantId,
        environment: notification.environment,
      }),
    );
    for (const failed of result.failedAttempts) {
      this.logger.warn(
        `${this.channel} ${notificationId}: provider ${failed.providerId} failed (${failed.failure}): ${failed.error}`,
      );
    }

    // 3a. Success (possibly on a fallback provider)
    if (result.success) {
      await this.notifications.markSent(
        notificationId,
        result.providerId,
        result.providerMessageId,
        rendered,
      );
      const fallback =
        result.failedAttempts.length > 0 ? ' (fallback provider)' : '';
      this.logger.log(
        `✓ ${this.channel} ${notificationId} sent to ${address} via ${result.providerId}${fallback} (attempt ${attempt})`,
      );
      return {
        provider: result.providerId,
        providerMessageId: result.providerMessageId,
      };
    }

    // 3b. Every provider failed: give up, or let BullMQ retry the whole chain later
    if (!result.retryable || attempt >= maxAttempts) return fail(result.error);

    await this.notifications.markRetrying(
      notificationId,
      result.error,
      attempt,
    );
    this.logger.warn(
      `↻ ${this.channel} ${notificationId} attempt ${attempt}/${maxAttempts} failed (${result.error}), retrying`,
    );
    throw new Error(result.error);
  }
}

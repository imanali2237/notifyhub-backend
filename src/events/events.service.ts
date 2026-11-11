import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { Types } from 'mongoose';
import type { ApiKeyContext } from '../api-keys/api-keys.interfaces.js';
import { CHANNEL_HANDLERS } from '../channels/channel-handlers.js';
import { CHANNELS, type Channel } from '../channels/channels.constants.js';
import type { ChannelContent } from '../channels/channels.interfaces.js';
import type { Env } from '../config/env.js';
import type { CreateNotificationInput } from '../notifications/notifications.interfaces.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ProviderRegistry } from '../providers/provider.registry.js';
import { NotificationQueueService } from '../queues/notification-queue.service.js';
import { REDIS } from '../redis/redis.constants.js';
import { assertValidTemplate } from '../templates/template-renderer.js';
import type { TriggerEventDto } from './dto/trigger-event.dto.js';
import {
  IDEMPOTENCY_KEY_PREFIX,
  MONGO_DUPLICATE_KEY_ERROR,
} from './events.constants.js';
import type { TriggerResult } from './events.interfaces.js';

/**
 * The API side of a trigger: validate, deduplicate, save, enqueue — then return
 * immediately. Nothing here is channel-specific: each requested channel is
 * handled through its ChannelHandler, so new channels need no changes here.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  /** Same idempotencyKey within this window = duplicate (IDEMPOTENCY_TTL_SECONDS). */
  private readonly idempotencyTtlSeconds: number;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly queue: NotificationQueueService,
    private readonly providers: ProviderRegistry,
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<Env, true>,
  ) {
    this.idempotencyTtlSeconds = config.get('IDEMPOTENCY_TTL_SECONDS');
  }

  async trigger(
    ctx: ApiKeyContext,
    dto: TriggerEventDto,
  ): Promise<TriggerResult> {
    const channels = this.requestedChannels(dto);
    channels.forEach((channel) => this.validateChannel(channel, dto));

    const transactionId = randomUUID();
    const idemKey = dto.idempotencyKey
      ? `${IDEMPOTENCY_KEY_PREFIX}:${ctx.tenantId}:${dto.idempotencyKey}`
      : null;

    // ── Guard 1: Redis SET NX — only the first request with this key wins ──
    if (idemKey) {
      const duplicate = await this.claimIdempotencyKey(
        ctx.tenantId,
        dto,
        idemKey,
        transactionId,
      );
      if (duplicate) return duplicate;
    }

    // ── Save one notification per channel (status: queued) ──
    const inputs: CreateNotificationInput[] = channels.map((channel) => ({
      _id: new Types.ObjectId(),
      transactionId,
      tenantId: ctx.tenantId,
      environment: ctx.environment,
      event: dto.event,
      channel,
      recipient: dto.to,
      payload: dto.payload ?? {},
      content: this.contentFor(channel, dto),
      idempotencyKey: dto.idempotencyKey,
    }));

    try {
      await this.notifications.createMany(inputs);
    } catch (err) {
      // ── Guard 2: unique index in Mongo (e.g. the Redis key had expired/was lost) ──
      if ((err as { code?: number }).code === MONGO_DUPLICATE_KEY_ERROR) {
        return this.duplicate(ctx.tenantId, dto, null);
      }
      if (idemKey) await this.redis.del(idemKey); // let the client retry
      throw err;
    }

    // ── Enqueue each notification on its channel's queue ──
    try {
      for (const { _id, channel } of inputs) {
        await this.queue.enqueue(channel, _id.toHexString());
      }
    } catch (err) {
      this.logger.error(
        `Could not enqueue ${transactionId}: ${(err as Error).message}`,
      );
      // Undo everything, so the client can simply retry the same request
      // (otherwise the retry would hit the idempotency guards as a "duplicate").
      await this.notifications.deleteMany(inputs.map((n) => n._id));
      if (idemKey) await this.redis.del(idemKey);
      throw new ServiceUnavailableException('Queue unavailable, please retry');
    }

    return {
      status: 'queued',
      transactionId,
      notifications: inputs.map((n) => ({
        channel: n.channel,
        notificationId: n._id.toHexString(),
      })),
    };
  }

  /**
   * Returns null if this request claimed the key (go ahead and send), or the
   * earlier request's result if it's a duplicate.
   */
  private async claimIdempotencyKey(
    tenantId: string,
    dto: TriggerEventDto,
    idemKey: string,
    transactionId: string,
  ): Promise<TriggerResult | null> {
    const claim = () =>
      this.redis.set(
        idemKey,
        transactionId,
        'EX',
        this.idempotencyTtlSeconds,
        'NX',
      );

    try {
      if (await claim()) return null;

      const previous = await this.duplicate(tenantId, dto, idemKey);
      if (previous.notifications.length > 0) return previous;

      // The key is claimed but nothing was ever saved for it (e.g. the process
      // crashed in between). Treat it as stale: release it and claim it again.
      this.logger.warn(`Releasing stale idempotency key ${idemKey}`);
      await this.redis.del(idemKey);
      if (await claim()) return null;
      return await this.duplicate(tenantId, dto, idemKey);
    } catch (err) {
      this.logger.error(`Idempotency check failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Temporarily unavailable, please retry',
      );
    }
  }

  /** Channels present in `dto.channels`, in a stable order. */
  private requestedChannels(dto: TriggerEventDto): Channel[] {
    const channels = CHANNELS.filter((c) => dto.channels[c] !== undefined);
    if (channels.length === 0) {
      throw new BadRequestException(
        `channels must include at least one of: ${CHANNELS.join(', ')}`,
      );
    }
    return channels;
  }

  private contentFor(channel: Channel, dto: TriggerEventDto): ChannelContent {
    // DTOs are class instances; store a plain object of their fields instead.
    return Object.fromEntries(
      Object.entries(dto.channels[channel] ?? {}),
    ) as ChannelContent;
  }

  /** Generic checks, driven by the channel's handler. */
  private validateChannel(channel: Channel, dto: TriggerEventDto): void {
    const handler = CHANNEL_HANDLERS[channel];

    // 0. The operator configured at least one provider for this channel.
    if (!this.providers.isEnabled(channel)) {
      throw new BadRequestException(
        `The ${channel} channel is not enabled on this server`,
      );
    }

    // 1. The recipient has the address this channel needs (email, subscriberId...).
    if (!dto.to[handler.recipientField]) {
      throw new BadRequestException(
        `to.${handler.recipientField} is required for the ${channel} channel`,
      );
    }

    // 2. Channel-specific content rules.
    const content = this.contentFor(channel, dto);
    const error = handler.validateContent(content);
    if (error) throw new BadRequestException(error);

    // 3. Every template field parses.
    for (const field of Object.keys(handler.templateFields)) {
      const template = content[field];
      if (template === undefined) continue;
      try {
        assertValidTemplate(template);
      } catch (err) {
        const reason = (err as Error).message.split('\n')[0];
        throw new BadRequestException(
          `${channel} ${field} is not a valid template: ${reason}`,
        );
      }
    }
  }

  private async duplicate(
    tenantId: string,
    dto: TriggerEventDto,
    idemKey: string | null,
  ): Promise<TriggerResult> {
    const transactionId = idemKey ? await this.redis.get(idemKey) : null;
    const existing = transactionId
      ? await this.notifications.findByTransaction(tenantId, transactionId)
      : await this.notifications.findByIdempotencyKey(
          tenantId,
          dto.idempotencyKey!,
        );

    return {
      status: 'duplicate',
      transactionId: transactionId ?? existing[0]?.transactionId ?? 'unknown',
      notifications: existing.map((n) => ({
        channel: n.channel,
        notificationId: n._id.toString(),
      })),
    };
  }
}

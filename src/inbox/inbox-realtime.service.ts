import { Inject, Injectable, Logger } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.constants.js';
import { INBOX_NAMESPACE, INBOX_SOCKET_EVENTS } from './inbox.constants.js';
import type {
  InboxMessageView,
  SubscriberContext,
} from './inbox.interfaces.js';

/** Socket.IO room of one subscriber's inbox (every open tab joins it). */
export const inboxRoom = (sub: SubscriberContext) =>
  `inbox:${sub.tenantId}:${sub.environment}:${sub.subscriberId}`;

/**
 * Pushes inbox updates to connected browsers — from ANY process.
 *
 * It publishes to Redis; every API instance's Socket.IO server (Redis adapter,
 * see redis-io.adapter.ts) receives it and forwards it to the subscriber's
 * open sockets. That is how the worker, which has no WebSocket server, reaches
 * the browser.
 *
 * Best effort: if Redis is down, the message is still saved in MongoDB and the
 * inbox UI gets it on its next fetch.
 */
@Injectable()
export class InboxRealtimeService {
  private readonly logger = new Logger(InboxRealtimeService.name);
  private readonly emitter: Emitter;

  constructor(@Inject(REDIS) redis: Redis) {
    // The emitter calls publish() without awaiting it; catch failures here so a
    // Redis outage can't become an unhandled promise rejection.
    const client = {
      publish: (channel: string, message: string | Buffer) =>
        redis.publish(channel, message).catch((err: Error) => {
          this.logger.warn(`Realtime update not published: ${err.message}`);
          return 0;
        }),
    };
    this.emitter = new Emitter(client).of(INBOX_NAMESPACE);
  }

  newMessage(
    sub: SubscriberContext,
    message: InboxMessageView,
    unreadCount: number,
  ): void {
    this.emitter
      .to(inboxRoom(sub))
      .emit(INBOX_SOCKET_EVENTS.message, { message, unreadCount });
  }

  unreadCount(sub: SubscriberContext, unreadCount: number): void {
    this.emitter
      .to(inboxRoom(sub))
      .emit(INBOX_SOCKET_EVENTS.unreadCount, { unreadCount });
  }
}

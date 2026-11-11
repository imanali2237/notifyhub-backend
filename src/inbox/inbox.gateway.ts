import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { inboxRoom, InboxRealtimeService } from './inbox-realtime.service.js';
import { InboxTokenService } from './inbox-token.service.js';
import { INBOX_NAMESPACE } from './inbox.constants.js';
import type { SubscriberContext } from './inbox.interfaces.js';
import { InboxService } from './inbox.service.js';

interface InboxSocketData {
  subscriber: SubscriberContext;
  expiresAt: Date;
  expiryTimer?: NodeJS.Timeout;
}
type InboxSocket = Socket<object, object, object, InboxSocketData>;

/**
 * The live inbox. The browser connects with its subscriber token:
 *
 *   io('http://localhost:3000/inbox', { auth: { token } })
 *
 * and joins its own room. New messages are pushed by InboxRealtimeService (from
 * the worker, through Redis); this gateway only accepts connections.
 * A bad or expired token is refused during the handshake (`connect_error`).
 */
@WebSocketGateway({ namespace: INBOX_NAMESPACE })
export class InboxGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InboxGateway.name);

  constructor(
    private readonly tokens: InboxTokenService,
    private readonly inbox: InboxService,
    private readonly realtime: InboxRealtimeService,
  ) {}

  afterInit(namespace: Namespace): void {
    // Runs before a connection is accepted.
    namespace.use((socket: InboxSocket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) {
        return next(new Error('Missing subscriber token (auth: { token })'));
      }
      this.tokens
        .verify(token)
        .then(({ subscriber, expiresAt }) => {
          socket.data.subscriber = subscriber;
          socket.data.expiresAt = expiresAt;
          next();
        })
        .catch(() => next(new Error('Invalid or expired subscriber token')));
    });
  }

  async handleConnection(socket: InboxSocket): Promise<void> {
    const { subscriber, expiresAt } = socket.data;
    await socket.join(inboxRoom(subscriber));

    // The token is only checked when connecting, so close the socket when it
    // expires; the client then reconnects with a fresh token.
    socket.data.expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, expiresAt.getTime() - Date.now()),
    );

    // Send the current badge count right away.
    this.realtime.unreadCount(
      subscriber,
      await this.inbox.unreadCount(subscriber),
    );
    this.logger.debug(`Inbox connected: ${subscriber.subscriberId}`);
  }

  handleDisconnect(socket: InboxSocket): void {
    clearTimeout(socket.data.expiryTimer);
  }
}

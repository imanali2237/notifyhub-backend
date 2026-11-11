import type { InAppMessage } from '../../channels/in-app/in-app.interfaces.js';
import type { InboxRealtimeService } from '../../inbox/inbox-realtime.service.js';
import type { InboxService } from '../../inbox/inbox.service.js';
import type { ChannelProvider, SendResult } from '../providers.interfaces.js';

/**
 * The in-app channel's provider — built in, no outside service:
 *  1. saves the message in the subscriber's inbox (MongoDB)
 *  2. pushes it live to their open browser tabs (Socket.IO, via Redis)
 *
 * Step 1 is what counts: once saved, the message is "sent" — a subscriber who
 * is offline sees it the next time the inbox loads.
 */
export class InboxProvider implements ChannelProvider<InAppMessage> {
  readonly id = 'inbox';
  readonly channel = 'in_app' as const;

  constructor(
    private readonly inbox: InboxService,
    private readonly realtime: InboxRealtimeService,
  ) {}

  async send(message: InAppMessage): Promise<SendResult> {
    const sub = {
      tenantId: message.tenantId,
      environment: message.environment,
      subscriberId: message.subscriberId,
    };

    try {
      const saved = await this.inbox.deliver(message);
      const unreadCount = await this.inbox.unreadCount(sub);
      this.realtime.newMessage(sub, saved, unreadCount);
      return { success: true, providerMessageId: saved.id };
    } catch (err) {
      // MongoDB unavailable → retry later.
      return {
        success: false,
        failure: 'temporary',
        error: `Inbox not saved: ${(err as Error).message}`,
      };
    }
  }
}

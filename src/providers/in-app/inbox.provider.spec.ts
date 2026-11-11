import type { InboxRealtimeService } from '../../inbox/inbox-realtime.service.js';
import type { InboxService } from '../../inbox/inbox.service.js';
import { InboxProvider } from './inbox.provider.js';

const message = {
  notificationId: 'n1',
  tenantId: 't1',
  environment: 'live' as const,
  subscriberId: 'user_1',
  title: 'Shipped',
  body: 'Order A42 shipped',
};
const sub = { tenantId: 't1', environment: 'live', subscriberId: 'user_1' };
const view = {
  id: 'm1',
  title: 'Shipped',
  body: 'Order A42 shipped',
  actionUrl: null,
  read: false,
  readAt: null,
  createdAt: new Date(),
};

const setup = (deliver: () => Promise<unknown>) => {
  const inbox = {
    deliver: vi.fn(deliver),
    unreadCount: vi.fn().mockResolvedValue(3),
  };
  const realtime = { newMessage: vi.fn() };
  const provider = new InboxProvider(
    inbox as unknown as InboxService,
    realtime as unknown as InboxRealtimeService,
  );
  return { provider, inbox, realtime };
};

describe('InboxProvider', () => {
  it('saves the message, then pushes it with the unread count', async () => {
    const { provider, inbox, realtime } = setup(() => Promise.resolve(view));

    expect(await provider.send(message)).toEqual({
      success: true,
      providerMessageId: 'm1',
    });
    expect(inbox.deliver).toHaveBeenCalledWith(message);
    expect(realtime.newMessage).toHaveBeenCalledWith(sub, view, 3);
  });

  it('a database error is temporary (retried later), nothing pushed', async () => {
    const { provider, realtime } = setup(() =>
      Promise.reject(new Error('connection lost')),
    );

    expect(await provider.send(message)).toEqual({
      success: false,
      failure: 'temporary',
      error: 'Inbox not saved: connection lost',
    });
    expect(realtime.newMessage).not.toHaveBeenCalled();
  });
});

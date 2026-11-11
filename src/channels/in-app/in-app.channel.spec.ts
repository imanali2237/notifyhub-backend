import { inAppChannel } from './in-app.channel.js';

const ctx = {
  notificationId: 'n1',
  tenantId: 't1',
  environment: 'live' as const,
};

describe('inAppChannel', () => {
  it('delivers to the subscriber id', () => {
    expect(inAppChannel.recipientField).toBe('subscriberId');
  });

  it('requires a non-blank body', () => {
    expect(inAppChannel.validateContent({ title: 'Hi' })).toMatch(/needs body/);
    expect(inAppChannel.validateContent({ body: '  ' })).toMatch(/needs body/);
    expect(inAppChannel.validateContent({ body: 'Hello' })).toBeNull();
  });

  it('renders every field as plain text', () => {
    expect(Object.values(inAppChannel.templateFields)).toEqual([
      'plain',
      'plain',
      'plain',
    ]);
  });

  it('builds an InAppMessage with the notification context', () => {
    expect(
      inAppChannel.buildMessage(
        'user_1',
        { title: 'Shipped', body: 'Order A42', actionUrl: '/orders/A42' },
        ctx,
      ),
    ).toEqual({
      ...ctx,
      subscriberId: 'user_1',
      title: 'Shipped',
      body: 'Order A42',
      actionUrl: '/orders/A42',
    });
  });

  it('drops empty optional fields', () => {
    expect(
      inAppChannel.buildMessage('user_1', { title: '', body: 'Hi' }, ctx),
    ).toEqual({ ...ctx, subscriberId: 'user_1', body: 'Hi' });
  });
});

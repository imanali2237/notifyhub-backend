import { emailChannel } from './email.channel.js';

describe('emailChannel', () => {
  it('delivers to the recipient email', () => {
    expect(emailChannel.recipientField).toBe('email');
  });

  it('requires html or text', () => {
    expect(emailChannel.validateContent({ subject: 's' })).toMatch(
      /html or text/,
    );
    expect(
      emailChannel.validateContent({ subject: 's', text: 't' }),
    ).toBeNull();
    expect(
      emailChannel.validateContent({ subject: 's', html: '<p/>' }),
    ).toBeNull();
  });

  it('builds an EmailMessage from rendered content', () => {
    expect(
      emailChannel.buildMessage(
        'a@b.co',
        { subject: 'Hi', text: 'Body' },
        { notificationId: 'n1', tenantId: 't1', environment: 'live' },
      ),
    ).toEqual({ to: 'a@b.co', subject: 'Hi', html: undefined, text: 'Body' });
  });
});

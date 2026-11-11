import type { ChannelHandler } from '../channels.interfaces.js';
import type { InAppMessage } from './in-app.interfaces.js';

/**
 * The in-app inbox: messages are stored in NotifyHub and shown inside YOUR app
 * (a bell icon with a list), live over a WebSocket. The recipient is
 * identified by your app's own user id (to.subscriberId), no email or phone.
 *
 * Every field is rendered as plain text (not HTML-escaped): the inbox UI must
 * display it as text, never as HTML.
 */
export const inAppChannel: ChannelHandler<InAppMessage> = {
  channel: 'in_app',
  recipientField: 'subscriberId',
  templateFields: { title: 'plain', body: 'plain', actionUrl: 'plain' },

  validateContent(content) {
    return content.body?.trim() ? null : 'in_app needs body';
  },

  buildMessage(address, rendered, notification) {
    return {
      ...notification,
      subscriberId: address,
      title: rendered.title || undefined,
      body: rendered.body ?? '',
      actionUrl: rendered.actionUrl || undefined,
    };
  },
};

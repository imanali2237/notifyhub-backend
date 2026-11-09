import type { ChannelHandler } from '../channels.interfaces.js';
import type { EmailMessage } from './email.interfaces.js';

export const emailChannel: ChannelHandler<EmailMessage> = {
  channel: 'email',
  recipientField: 'email',
  templateFields: { subject: 'plain', html: 'html', text: 'plain' },

  validateContent(content) {
    return content.html || content.text ? null : 'email needs html or text';
  },

  buildMessage(address, rendered) {
    return {
      to: address,
      subject: rendered.subject ?? '',
      html: rendered.html,
      text: rendered.text,
    };
  },
};

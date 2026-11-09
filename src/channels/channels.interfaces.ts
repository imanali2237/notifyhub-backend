import type { Recipient } from '../notifications/notifications.interfaces.js';
import type { Channel } from './channels.constants.js';

/** Template text per field, e.g. { subject: "Hi {{name}}", html: "<p>..." } */
export type ChannelContent = Record<string, string | undefined>;

/**
 * How a template field is rendered:
 *  - 'html'  → values are HTML-escaped (a payload can't inject markup)
 *  - 'plain' → no escaping (subjects, SMS text, push titles...)
 */
export type TemplateFieldMode = 'html' | 'plain';

/** Recipient fields a channel can deliver to. */
export type RecipientAddressField = keyof Pick<Recipient, 'email' | 'phone'>;

/**
 * Everything the generic core needs to know about one channel.
 * The trigger API, the renderer and the worker only talk to this interface —
 * never to "email" or "sms" directly.
 */
export interface ChannelHandler<TMessage = unknown> {
  readonly channel: Channel;

  /** Which recipient field this channel sends to: to.email, to.phone... */
  readonly recipientField: RecipientAddressField;

  /** Which content fields are templates, and how to render each one. */
  readonly templateFields: Record<string, TemplateFieldMode>;

  /** Extra rules beyond the DTO. Return an error message, or null if valid. */
  validateContent(content: ChannelContent): string | null;

  /** Turns rendered content into the message the channel's providers accept. */
  buildMessage(address: string, rendered: ChannelContent): TMessage;
}

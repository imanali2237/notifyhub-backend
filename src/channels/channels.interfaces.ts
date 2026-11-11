import type { ApiKeyEnvironment } from '../generated/prisma/client.js';
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

/**
 * Recipient fields a channel can deliver to: to.email, or to.subscriberId for
 * the in-app inbox (the user is identified by your app's id).
 * A phone channel (SMS) would add `phone` to Recipient and here.
 */
export type RecipientAddressField = keyof Pick<
  Recipient,
  'email' | 'subscriberId'
>;

/** The notification being sent — for channels that need more than an address. */
export interface NotificationContext {
  notificationId: string;
  tenantId: string;
  environment: ApiKeyEnvironment;
}

/**
 * Everything the generic core needs to know about one channel.
 * The trigger API, the renderer and the worker only talk to this interface —
 * never to "email" or "sms" directly.
 */
export interface ChannelHandler<TMessage = unknown> {
  readonly channel: Channel;

  /** Which recipient field this channel sends to: to.email, to.subscriberId... */
  readonly recipientField: RecipientAddressField;

  /** Which content fields are templates, and how to render each one. */
  readonly templateFields: Record<string, TemplateFieldMode>;

  /** Extra rules beyond the DTO. Return an error message, or null if valid. */
  validateContent(content: ChannelContent): string | null;

  /** Turns rendered content into the message the channel's providers accept. */
  buildMessage(
    address: string,
    rendered: ChannelContent,
    notification: NotificationContext,
  ): TMessage;
}

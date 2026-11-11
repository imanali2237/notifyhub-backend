import type { NotificationContext } from '../channels.interfaces.js';

/** What the in-app inbox provider receives: one message for one subscriber's inbox. */
export interface InAppMessage extends NotificationContext {
  subscriberId: string;
  title?: string;
  body: string;
  actionUrl?: string;
}

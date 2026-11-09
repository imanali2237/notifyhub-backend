import type { Channel } from '../channels/channels.constants.js';

export interface TriggerResult {
  status: 'queued' | 'duplicate';
  /** Groups the notifications created by this trigger. */
  transactionId: string;
  /** One per requested channel. */
  notifications: { channel: Channel; notificationId: string }[];
}

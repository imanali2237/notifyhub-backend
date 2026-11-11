import type { Types } from 'mongoose';
import type { Channel } from '../channels/channels.constants.js';
import type { ChannelContent } from '../channels/channels.interfaces.js';
import type { ApiKeyEnvironment } from '../generated/prisma/client.js';
import type { NOTIFICATION_STATUSES } from './notifications.constants.js';

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/**
 * Who receives it. One recipient can be reached on several channels;
 * each channel picks the field it needs (email → email, in_app → subscriberId).
 */
export interface Recipient {
  subscriberId: string; // the client app's own user id
  email?: string;
  name?: string;
}

/** One entry in the audit trail. */
export interface NotificationEvent {
  status: NotificationStatus;
  at: Date;
  meta?: Record<string, unknown>;
}

/** Data needed to create one notification (one channel of one trigger). */
export interface CreateNotificationInput {
  _id: Types.ObjectId;
  transactionId: string;
  tenantId: string;
  environment: ApiKeyEnvironment;
  event: string;
  channel: Channel;
  recipient: Recipient;
  payload: Record<string, unknown>;
  content: ChannelContent;
  idempotencyKey?: string;
}

import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { CHANNELS, type Channel } from '../../channels/channels.constants.js';
import type { ChannelContent } from '../../channels/channels.interfaces.js';
import {
  NOTIFICATION_COLLECTION,
  NOTIFICATION_RETENTION_DAYS,
  NOTIFICATION_STATUSES,
} from '../notifications.constants.js';
import type {
  NotificationEvent,
  NotificationStatus,
  Recipient,
} from '../notifications.interfaces.js';

/**
 * One document per message per channel: a trigger with email + sms creates two,
 * sharing the same transactionId. Written by the API, updated by the worker.
 *
 * Every @Prop has an explicit `type`: don't rely on TypeScript metadata, which
 * can't describe union types and differs between compilers (tsc vs vitest).
 */
@Schema({ collection: NOTIFICATION_COLLECTION, timestamps: true })
export class Notification {
  /** Groups all notifications created by one trigger call. */
  @Prop({ type: String, required: true })
  transactionId: string;

  @Prop({ type: String, required: true })
  tenantId: string;

  @Prop({ type: String, required: true, enum: ['test', 'live'] })
  environment: 'test' | 'live';

  /** Trigger name, e.g. "order-shipped" (becomes the workflow key later). */
  @Prop({ type: String, required: true })
  event: string;

  @Prop({ type: String, required: true, enum: CHANNELS })
  channel: Channel;

  @Prop(
    raw({
      subscriberId: String,
      email: String,
      name: String,
      _id: false,
    }),
  )
  recipient: Recipient;

  /** Data from the client app, used to fill the templates ({{orderId}}). */
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  /** Channel-specific templates as received, e.g. email: {subject, html, text}. */
  @Prop({ type: Object, required: true })
  content: ChannelContent;

  /** What was actually sent, after rendering. Filled in by the worker. */
  @Prop({ type: Object })
  rendered?: ChannelContent;

  @Prop({
    type: String,
    required: true,
    enum: NOTIFICATION_STATUSES,
    default: 'queued',
  })
  status: NotificationStatus;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: String })
  lastError?: string;

  /** Which provider sent it, e.g. 'smtp', 'brevo', 'textbee'. */
  @Prop({ type: String })
  provider?: string;

  @Prop({ type: String })
  providerMessageId?: string;

  @Prop({ type: String })
  idempotencyKey?: string;

  /** Full audit trail: every status change with a timestamp. */
  @Prop({
    type: [raw({ status: String, at: Date, meta: Object, _id: false })],
    default: [],
  })
  events: NotificationEvent[];

  // Added by `timestamps: true`
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Dashboard: "latest notifications of my tenant"
NotificationSchema.index({ tenantId: 1, createdAt: -1 });
// Dashboard filters: "failed SMS of subscriber X"
NotificationSchema.index({
  tenantId: 1,
  'recipient.subscriberId': 1,
  channel: 1,
  status: 1,
});
// "All notifications of this trigger"
NotificationSchema.index({ tenantId: 1, transactionId: 1 });
// Second guard against duplicates (Redis is the first):
// one notification per tenant + idempotencyKey + channel.
NotificationSchema.index(
  { tenantId: 1, idempotencyKey: 1, channel: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
// MongoDB deletes documents automatically once createdAt is older than this.
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 },
);

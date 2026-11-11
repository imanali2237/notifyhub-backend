import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { ApiKeyEnvironment } from '../../generated/prisma/client.js';
import { INBOX_COLLECTION, INBOX_RETENTION_DAYS } from '../inbox.constants.js';

/**
 * One message in one subscriber's in-app inbox. Written by the worker (via the
 * inbox provider), read and marked read by the inbox UI.
 * The full delivery log stays in `notifications`; this is just the feed.
 */
@Schema({ collection: INBOX_COLLECTION, timestamps: true })
export class InboxMessage {
  @Prop({ type: String, required: true })
  tenantId: string;

  @Prop({ type: String, required: true, enum: ['test', 'live'] })
  environment: ApiKeyEnvironment;

  @Prop({ type: String, required: true })
  subscriberId: string;

  /** The notification that created it. Unique: a retried job never adds a second copy. */
  @Prop({ type: String, required: true, unique: true })
  notificationId: string;

  @Prop({ type: String })
  title?: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: String })
  actionUrl?: string;

  /** null = unread. */
  @Prop({ type: Date, default: null })
  readAt: Date | null;

  // Added by `timestamps: true`
  createdAt: Date;
  updatedAt: Date;
}

export type InboxMessageDocument = HydratedDocument<InboxMessage>;
export const InboxMessageSchema = SchemaFactory.createForClass(InboxMessage);

// The feed, newest first (cursor = _id) — also serves "unread only".
InboxMessageSchema.index({
  tenantId: 1,
  environment: 1,
  subscriberId: 1,
  readAt: 1,
  _id: -1,
});
InboxMessageSchema.index({
  tenantId: 1,
  environment: 1,
  subscriberId: 1,
  _id: -1,
});
InboxMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: INBOX_RETENTION_DAYS * 24 * 60 * 60 },
);

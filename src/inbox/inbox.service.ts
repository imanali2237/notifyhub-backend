import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { InAppMessage } from '../channels/in-app/in-app.interfaces.js';
import { toInboxMessageView } from './inbox-message.mapper.js';
import type {
  InboxMessageView,
  InboxPage,
  SubscriberContext,
} from './inbox.interfaces.js';
import { InboxMessage } from './schemas/inbox-message.schema.js';

/**
 * All reads/writes of the inbox_messages collection. Every query is scoped to
 * one subscriber (tenant + environment + subscriberId), so one subscriber can
 * never see or change another's messages.
 */
@Injectable()
export class InboxService {
  constructor(
    @InjectModel(InboxMessage.name)
    private readonly model: Model<InboxMessage>,
  ) {}

  /**
   * Adds a message to the subscriber's inbox. Idempotent: if the job runs twice
   * for the same notification, the existing message is returned unchanged.
   */
  async deliver(message: InAppMessage): Promise<InboxMessageView> {
    const { notificationId, ...fields } = message;
    const doc = await this.model
      .findOneAndUpdate(
        { notificationId },
        { $setOnInsert: { notificationId, ...fields, readAt: null } },
        { upsert: true, new: true },
      )
      .lean();
    return toInboxMessageView(doc);
  }

  /** Newest first. `before` = the nextCursor of the previous page. */
  async list(
    sub: SubscriberContext,
    opts: { limit: number; before?: string; unreadOnly?: boolean },
  ): Promise<InboxPage> {
    const filter: Record<string, unknown> = { ...sub };
    if (opts.unreadOnly) filter.readAt = null;
    if (opts.before && isValidObjectId(opts.before)) {
      filter._id = { $lt: opts.before };
    }

    // Fetch one extra to know whether there is a next page.
    const [docs, unreadCount] = await Promise.all([
      this.model
        .find(filter)
        .sort({ _id: -1 })
        .limit(opts.limit + 1)
        .lean(),
      this.unreadCount(sub),
    ]);
    const page = docs.slice(0, opts.limit);
    return {
      messages: page.map(toInboxMessageView),
      unreadCount,
      nextCursor:
        docs.length > opts.limit ? page[page.length - 1]._id.toString() : null,
    };
  }

  unreadCount(sub: SubscriberContext): Promise<number> {
    return this.model.countDocuments({ ...sub, readAt: null });
  }

  /** Marks one message read (no-op if already read). null = not found. */
  async markRead(
    sub: SubscriberContext,
    id: string,
  ): Promise<InboxMessageView | null> {
    if (!isValidObjectId(id)) return null;
    await this.model.updateOne(
      { _id: id, ...sub, readAt: null },
      { readAt: new Date() },
    );
    const doc = await this.model.findOne({ _id: id, ...sub }).lean();
    return doc ? toInboxMessageView(doc) : null;
  }

  /** Returns how many messages were marked read. */
  async markAllRead(sub: SubscriberContext): Promise<number> {
    const result = await this.model.updateMany(
      { ...sub, readAt: null },
      { readAt: new Date() },
    );
    return result.modifiedCount;
  }
}

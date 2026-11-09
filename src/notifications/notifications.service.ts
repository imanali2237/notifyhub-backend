import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type Types } from 'mongoose';
import type { ChannelContent } from '../channels/channels.interfaces.js';
import type {
  CreateNotificationInput,
  NotificationStatus,
} from './notifications.interfaces.js';
import { Notification } from './schemas/notification.schema.js';

/**
 * All reads/writes of the notifications collection. Used by both processes:
 * the API creates notifications, the worker moves them through their lifecycle.
 * Every status change also appends an entry to `events` (the audit trail).
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<Notification>,
  ) {}

  /** One document per channel of a trigger, inserted together. */
  createMany(inputs: CreateNotificationInput[]) {
    const at = new Date();
    return this.model.insertMany(
      inputs.map((input) => ({
        ...input,
        status: 'queued',
        events: [{ status: 'queued', at }],
      })),
    );
  }

  /** Rollback helper: remove notifications that could not be enqueued. */
  deleteMany(ids: Types.ObjectId[]) {
    return this.model.deleteMany({ _id: { $in: ids } });
  }

  findById(id: string) {
    return this.model.findById(id).lean();
  }

  /** Tenant-scoped read: another tenant's id simply isn't found. */
  findForTenant(tenantId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    return this.model.findOne({ _id: id, tenantId }).lean();
  }

  /** All notifications (one per channel) created by one trigger. */
  findByTransaction(tenantId: string, transactionId: string) {
    return this.model
      .find({ tenantId, transactionId }, { channel: 1, transactionId: 1 })
      .lean();
  }

  findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
    return this.model
      .find({ tenantId, idempotencyKey }, { channel: 1, transactionId: 1 })
      .lean();
  }

  markProcessing(id: string, attempt: number) {
    return this.transition(
      id,
      'processing',
      { attempts: attempt },
      { attempt },
    );
  }

  markRetrying(id: string, error: string, attempt: number) {
    return this.transition(
      id,
      'retrying',
      { lastError: error },
      { attempt, error },
    );
  }

  markSent(
    id: string,
    provider: string,
    providerMessageId: string | undefined,
    rendered: ChannelContent,
  ) {
    return this.transition(
      id,
      'sent',
      { provider, providerMessageId, rendered, lastError: null },
      { provider, providerMessageId },
    );
  }

  markFailed(id: string, error: string) {
    return this.transition(id, 'failed', { lastError: error }, { error });
  }

  private transition(
    id: string,
    status: NotificationStatus,
    fields: Record<string, unknown>,
    meta?: Record<string, unknown>,
  ) {
    return this.model.updateOne(
      { _id: id },
      {
        $set: { status, ...fields },
        $push: { events: { status, at: new Date(), meta } },
      },
    );
  }
}

import type { InboxMessageView } from './inbox.interfaces.js';
import type { InboxMessage } from './schemas/inbox-message.schema.js';

/** Only what the inbox UI needs — never tenant ids or internal fields. */
export function toInboxMessageView(
  doc: InboxMessage & { _id: { toString(): string } },
): InboxMessageView {
  return {
    id: doc._id.toString(),
    title: doc.title ?? null,
    body: doc.body,
    actionUrl: doc.actionUrl ?? null,
    read: doc.readAt !== null,
    readAt: doc.readAt,
    createdAt: doc.createdAt,
  };
}

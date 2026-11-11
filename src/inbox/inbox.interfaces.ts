import type { Request } from 'express';
import type { ApiKeyEnvironment } from '../generated/prisma/client.js';

/** Whose inbox: one subscriber of one tenant, in one environment (test/live). */
export interface SubscriberContext {
  tenantId: string;
  environment: ApiKeyEnvironment;
  subscriberId: string;
}

/** Claims inside a subscriber token. */
export interface InboxTokenPayload {
  sub: string; // subscriberId
  tid: string; // tenantId
  env: ApiKeyEnvironment;
}

/** An Express request after SubscriberAuthGuard has run. */
export type SubscriberRequest = Request & { subscriber?: SubscriberContext };

/** One inbox message as the inbox UI receives it (REST and WebSocket). */
export interface InboxMessageView {
  id: string;
  title: string | null;
  body: string;
  actionUrl: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface InboxPage {
  messages: InboxMessageView[];
  unreadCount: number;
  /** Pass as `before` to get the next (older) page; null on the last page. */
  nextCursor: string | null;
}

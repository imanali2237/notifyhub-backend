export const INBOX_COLLECTION = 'inbox_messages';

/** Inbox messages are deleted automatically after this (MongoDB TTL index). */
export const INBOX_RETENTION_DAYS = 90;

/** Socket.IO namespace the inbox UI connects to: io('http://host:3000/inbox'). */
export const INBOX_NAMESPACE = '/inbox';

/** Events the server sends to a connected inbox. */
export const INBOX_SOCKET_EVENTS = {
  /** A new message arrived: { message, unreadCount } */
  message: 'notification',
  /** The unread count changed (e.g. read in another tab): { unreadCount } */
  unreadCount: 'unread_count',
  /** Connection refused (bad/expired token): { message } */
  error: 'inbox_error',
} as const;

/** Page size of GET /v1/inbox/messages. */
export const INBOX_DEFAULT_PAGE_SIZE = 20;
export const INBOX_MAX_PAGE_SIZE = 100;

/**
 * Subscriber tokens are signed with their OWN key, derived from JWT_SECRET.
 * So a subscriber token can never be used as a dashboard login token (or the
 * other way round), and operators don't need to manage another secret.
 */
export const INBOX_TOKEN_KEY_LABEL = 'notifyhub:inbox-token:v1';
export const INBOX_TOKEN_AUDIENCE = 'notifyhub:inbox';

/** Field lengths for in-app content. */
export const IN_APP_TITLE_MAX_LENGTH = 200;
export const IN_APP_BODY_MAX_LENGTH = 5000;
export const IN_APP_ACTION_URL_MAX_LENGTH = 2048;
/**
 * actionUrl must start with http://, https:// or "/" (a path in your app),
 * written literally before any {{placeholder}} — so a payload can never turn it
 * into a "javascript:" link.
 */
export const IN_APP_ACTION_URL_PATTERN = /^(https?:\/\/[^/{]|\/(?!\/))/;

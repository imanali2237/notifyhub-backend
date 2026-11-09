/**
 * Lifecycle of one notification (any channel):
 *   queued → processing → sent
 *                      ↘ retrying → processing → ... → failed
 */
export const NOTIFICATION_STATUSES = [
  'queued',
  'processing',
  'retrying',
  'sent',
  'failed',
] as const;

/** Logs are deleted automatically after this (MongoDB TTL index). Keeps storage small. */
export const NOTIFICATION_RETENTION_DAYS = 30;

export const NOTIFICATION_COLLECTION = 'notifications';

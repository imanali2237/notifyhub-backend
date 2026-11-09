/**
 * What goes into a job, for every channel. Deliberately tiny: the worker loads
 * everything else from Mongo, so Mongo stays the single source of truth and
 * Redis memory stays small.
 */
export interface NotificationJobData {
  notificationId: string;
}

import type { Channel } from '../channels/channels.constants.js';

/**
 * Why a send failed — decides what happens next:
 *  - temporary → network/timeout/rate limit/5xx: try the next provider now;
 *                if all fail, BullMQ retries later with backoff
 *  - provider  → THIS provider can't send (bad credentials, quota used up,
 *                account suspended): try the next provider; retrying later won't help
 *  - message   → the message itself is rejected (recipient doesn't exist):
 *                stop — every provider would reject it too
 */
export type SendFailureKind = 'temporary' | 'provider' | 'message';

export type SendResult =
  | { success: true; providerMessageId?: string }
  | { success: false; failure: SendFailureKind; error: string };

/**
 * The plug-and-play contract (architecture doc §7). Every provider — SMTP, Brevo,
 * Twilio, Telegram... — is one class implementing this. The worker never knows
 * which concrete provider it's using. Credentials come from .env when the
 * provider is created. send() should not throw: report failures in the result.
 */
export interface ChannelProvider<TMessage = unknown> {
  /** Unique id, e.g. 'smtp', 'brevo', 'textbee'. Stored on each notification. */
  readonly id: string;
  readonly channel: Channel;
  send(message: TMessage): Promise<SendResult>;
}

/** One provider that was tried and failed. */
export interface FailedAttempt {
  providerId: string;
  failure: SendFailureKind;
  error: string;
}

/** Result of sending through a channel's providers in order (with failover). */
export type DispatchResult =
  | {
      success: true;
      providerId: string;
      providerMessageId?: string;
      /** Providers tried before the one that succeeded. */
      failedAttempts: FailedAttempt[];
    }
  | {
      success: false;
      /** true → worth retrying later (at least one provider failed temporarily). */
      retryable: boolean;
      error: string;
      failedAttempts: FailedAttempt[];
    };

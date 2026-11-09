import type { Channel } from '../channels/channels.constants.js';

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  /** true → worth retrying (timeout, rate limit, 5xx API error); false → give up (invalid address) */
  retryable?: boolean;
  error?: string;
}

/**
 * The plug-and-play contract (architecture doc §7). Every provider — SMTP, Brevo,
 * Twilio, Telegram... — is one class implementing this. The worker never knows
 * which concrete provider it's using.
 */
export interface ChannelProvider<TMessage = unknown> {
  /** Unique id, e.g. 'smtp', 'brevo', 'textbee'. Stored on each notification. */
  readonly id: string;
  readonly channel: Channel;
  send(message: TMessage): Promise<SendResult>;
}

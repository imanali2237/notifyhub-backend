import type { ConfigService } from '@nestjs/config';
import type { EmailMessage } from '../../channels/email/email.interfaces.js';
import {
  type FromAddress,
  parseFromAddress,
} from '../../common/utils/parse-from-address.js';
import type { Env } from '../../config/env.js';
import type {
  ChannelProvider,
  SendFailureKind,
  SendResult,
} from '../providers.interfaces.js';
import { BREVO_SEND_URL } from './email-provider.constants.js';

/**
 * Sends through Brevo's transactional email REST API (free plan: 300 emails/day).
 * Settings: BREVO_API_KEY, BREVO_FROM (a sender verified in your Brevo account),
 * BREVO_TIMEOUT_MS.
 */
export class BrevoEmailProvider implements ChannelProvider<EmailMessage> {
  readonly id = 'brevo';
  readonly channel = 'email' as const;
  private readonly apiKey: string;
  private readonly sender: FromAddress;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('BREVO_API_KEY', { infer: true }) ?? '';
    // Format already checked at startup (env.ts), so this can't be null here.
    this.sender = parseFromAddress(
      config.get('BREVO_FROM', { infer: true }) ?? '',
    )!;
    this.timeoutMs = config.get('BREVO_TIMEOUT_MS');
  }

  async send(message: EmailMessage): Promise<SendResult> {
    let res: Response;
    try {
      res = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // Network error or timeout — Brevo may be fine a moment later.
      return {
        success: false,
        failure: 'temporary',
        error: `Brevo unreachable: ${(err as Error).message}`,
      };
    }

    const body = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
    };
    if (res.ok) return { success: true, providerMessageId: body.messageId };

    return {
      success: false,
      failure: classifyBrevoStatus(res.status),
      error: `Brevo ${res.status}: ${body.message ?? res.statusText}`,
    };
  }
}

/**
 * 429 (rate limit) and 5xx → temporary. Everything else (401 bad key, 402 no
 * credits, 403 blocked, 400 e.g. unverified sender) is a problem with this
 * Brevo account, so another provider may still deliver the email.
 */
export function classifyBrevoStatus(status: number): SendFailureKind {
  return status === 429 || status >= 500 ? 'temporary' : 'provider';
}

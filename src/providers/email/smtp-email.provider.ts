import type { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import type { EmailMessage } from '../../channels/email/email.interfaces.js';
import type { Env } from '../../config/env.js';
import type {
  ChannelProvider,
  SendFailureKind,
  SendResult,
} from '../providers.interfaces.js';
import {
  SMTP_AUTH_ERROR_CODE,
  SMTP_AUTH_RESPONSE_CODES,
  SMTP_MAILBOX_RESPONSE_CODES,
  SMTP_MESSAGE_ERROR_CODES,
  SMTP_MESSAGE_STATUS_SUBJECTS,
} from './email-provider.constants.js';
import { createSmtpTransport } from './smtp-transport.factory.js';

export interface SmtpError extends Error {
  code?: string;
  responseCode?: number;
  /** The server's full reply, e.g. "550 5.4.5 Daily sending quota exceeded". */
  response?: string;
}

/** Enhanced status code in an SMTP reply ("5.1.1" → subject 1), if any. */
const ENHANCED_STATUS = /\b[245]\.(\d{1,3})\.\d{1,3}\b/;

/**
 * Sends through any SMTP server: Gmail, Outlook, Mailpit (local), your own...
 * Settings: SMTP_HOST, SMTP_PORT, SMTP_FROM (+ SMTP_USER/PASS, SMTP_SECURE).
 */
export class SmtpEmailProvider implements ChannelProvider<EmailMessage> {
  readonly id = 'smtp';
  readonly channel = 'email' as const;
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = createSmtpTransport(config);
    this.from = config.get('SMTP_FROM', { infer: true }) ?? '';
  }

  /** Closes pooled connections (on shutdown). */
  close(): void {
    this.transporter.close();
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        ...message,
      });
      return { success: true, providerMessageId: info.messageId };
    } catch (err) {
      const e = err as SmtpError;
      return {
        success: false,
        failure: classifySmtpError(e),
        error: e.message,
      };
    }
  }
}

/**
 * SMTP reply codes: 4xx = "try later" → temporary; no reply at all (server
 * down, timeout) → temporary; login failures → provider; 5xx → depends on what
 * it's about (see SMTP_MESSAGE_STATUS_SUBJECTS).
 */
export function classifySmtpError(e: SmtpError): SendFailureKind {
  if (e.code && SMTP_MESSAGE_ERROR_CODES.includes(e.code)) return 'message';
  if (e.code === SMTP_AUTH_ERROR_CODE) return 'provider';

  const code = e.responseCode;
  if (!code || code < 500) return 'temporary';
  if (SMTP_AUTH_RESPONSE_CODES.includes(code)) return 'provider';

  const subject = ENHANCED_STATUS.exec(e.response ?? '')?.[1];
  if (subject !== undefined) {
    return SMTP_MESSAGE_STATUS_SUBJECTS.includes(Number(subject))
      ? 'message'
      : 'provider';
  }
  return SMTP_MAILBOX_RESPONSE_CODES.includes(code) ? 'message' : 'provider';
}

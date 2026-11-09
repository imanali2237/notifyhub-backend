import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import type { EmailMessage } from '../../channels/email/email.interfaces.js';
import type { Env } from '../../config/env.js';
import { createSmtpTransport } from '../../mail/smtp-transport.factory.js';
import type { ChannelProvider, SendResult } from '../providers.interfaces.js';
import { SMTP_PERMANENT_ERROR_CODES } from './email-provider.constants.js';

interface SmtpError extends Error {
  code?: string;
  responseCode?: number;
}

/**
 * Sends through the SMTP server from .env (Mailpit locally).
 * Phase 3 replaces "one server from .env" with per-tenant provider configs.
 */
@Injectable()
export class SmtpEmailProvider implements ChannelProvider<EmailMessage> {
  readonly id = 'smtp';
  readonly channel = 'email' as const;
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = createSmtpTransport(config);
    this.from = config.get('SMTP_FROM');
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
        retryable: this.isRetryable(e),
        error: e.message,
      };
    }
  }

  /**
   * SMTP reply codes: 4xx = temporary ("try later") → retry,
   * 5xx = permanent (e.g. 550 mailbox doesn't exist) → don't.
   * No reply code at all = network problem (server down, timeout) → retry.
   */
  private isRetryable(e: SmtpError): boolean {
    if (e.code && SMTP_PERMANENT_ERROR_CODES.includes(e.code)) return false;
    if (e.responseCode && e.responseCode >= 500) return false;
    return true;
  }
}

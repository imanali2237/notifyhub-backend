import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';
import type { MailMessage } from './mail.interfaces.js';
import { createSmtpTransport } from './smtp-transport.factory.js';

/**
 * NotifyHub's OWN system emails (signup OTP, password reset...).
 * Locally this goes to Mailpit → http://localhost:8025.
 *
 * Not to be confused with tenant notifications — those go through the channel
 * + provider system (see SmtpEmailProvider) and the worker.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = createSmtpTransport(config);
    this.from = config.get('SMTP_FROM');
  }

  async send(message: MailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      ...message,
    });
    this.logger.log(
      `Sent "${message.subject}" to ${message.to} (${info.messageId})`,
    );
  }
}

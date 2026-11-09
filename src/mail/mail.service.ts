import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';
import type { MailMessage } from './mail.interfaces.js';

/**
 * NotifyHub's OWN system emails (signup OTP, password reset...).
 * Locally this goes to Mailpit → http://localhost:8025.
 *
 * Not to be confused with tenant notifications — those will go through the
 * provider system (Phase 3), with each tenant's own SMTP/Brevo/etc. credentials.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST'),
      port: config.get('SMTP_PORT'),
      secure: false, // Mailpit has no TLS; real providers on 465 would need true
    });
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

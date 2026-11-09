import { Injectable, Logger } from '@nestjs/common';
import type { EmailMessage } from '../channels/email/email.interfaces.js';
import { ProviderRegistry } from '../providers/provider.registry.js';
import type { MailMessage } from './mail.interfaces.js';

/**
 * NotifyHub's OWN system emails (signup OTP, password reset...). Sent right away
 * (not queued) through the same email providers as notifications, with the
 * same failover order (EMAIL_PROVIDERS). Locally → Mailpit, http://localhost:8025.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly providers: ProviderRegistry) {}

  async send(message: MailMessage): Promise<void> {
    const email: EmailMessage = message;
    const result = await this.providers.send('email', email);
    if (!result.success) throw new Error(result.error);

    const fallback =
      result.failedAttempts.length > 0 ? ', fallback provider' : '';
    // Never log the subject/body: system emails contain secrets (OTP codes).
    this.logger.log(
      `Sent system email to ${message.to} via ${result.providerId}${fallback}`,
    );
  }
}

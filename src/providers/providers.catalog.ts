import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { BrevoEmailProvider } from './email/brevo-email.provider.js';
import type { EmailProviderId } from './email/email-provider.constants.js';
import { SmtpEmailProvider } from './email/smtp-email.provider.js';
import type { ChannelProvider } from './providers.interfaces.js';

type ProviderFactory = (config: ConfigService<Env, true>) => ChannelProvider;

/** Every built-in email provider, by the id used in EMAIL_PROVIDERS. */
export const EMAIL_PROVIDER_CATALOG: Record<EmailProviderId, ProviderFactory> =
  {
    smtp: (config) => new SmtpEmailProvider(config),
    brevo: (config) => new BrevoEmailProvider(config),
  };

/**
 * Creates ONLY the providers the operator listed, in their failover order.
 * (Settings were already checked at startup, see env.ts.)
 */
export function buildEnabledProviders(
  config: ConfigService<Env, true>,
): ChannelProvider[] {
  return config
    .get('EMAIL_PROVIDERS', { infer: true })
    .map((id) => EMAIL_PROVIDER_CATALOG[id](config));
  // New channel → add its *_PROVIDERS list here, e.g. ...config.get('SMS_PROVIDERS')
}

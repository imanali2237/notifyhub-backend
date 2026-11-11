import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { BrevoEmailProvider } from './email/brevo-email.provider.js';
import type { EmailProviderId } from './email/email-provider.constants.js';
import { SmtpEmailProvider } from './email/smtp-email.provider.js';
import type { InboxRealtimeService } from '../inbox/inbox-realtime.service.js';
import type { InboxService } from '../inbox/inbox.service.js';
import { InboxProvider } from './in-app/inbox.provider.js';
import type { ChannelProvider } from './providers.interfaces.js';

type ProviderFactory = (config: ConfigService<Env, true>) => ChannelProvider;

/** Services that built-in providers need (outside providers only need config). */
export interface ProviderDeps {
  inbox: InboxService;
  inboxRealtime: InboxRealtimeService;
}

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
  deps: ProviderDeps,
): ChannelProvider[] {
  const providers = config
    .get('EMAIL_PROVIDERS', { infer: true })
    .map((id) => EMAIL_PROVIDER_CATALOG[id](config));

  // The in-app inbox is built in: no outside service, just on or off.
  if (config.get('IN_APP_ENABLED')) {
    providers.push(new InboxProvider(deps.inbox, deps.inboxRealtime));
  }

  // New channel → add its providers here, e.g. ...config.get('SMS_PROVIDERS')
  return providers;
}

import { Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHANNELS } from '../channels/channels.constants.js';
import type { Env } from '../config/env.js';
import { InboxRealtimeService } from '../inbox/inbox-realtime.service.js';
import { InboxModule } from '../inbox/inbox.module.js';
import { InboxService } from '../inbox/inbox.service.js';
import { ProviderRegistry } from './provider.registry.js';
import { buildEnabledProviders } from './providers.catalog.js';

const logger = new Logger('Providers');

/**
 * Builds the ProviderRegistry from .env (EMAIL_PROVIDERS, IN_APP_ENABLED...): only the
 * providers the operator listed, in failover order. A channel with none is
 * disabled. Used by the worker (notifications) and the API (OTP emails,
 * rejecting disabled channels).
 */
@Module({
  imports: [InboxModule],
  providers: [
    {
      provide: ProviderRegistry,
      inject: [ConfigService, InboxService, InboxRealtimeService],
      useFactory: (
        config: ConfigService<Env, true>,
        inbox: InboxService,
        inboxRealtime: InboxRealtimeService,
      ) => {
        const registry = new ProviderRegistry(
          buildEnabledProviders(config, { inbox, inboxRealtime }),
        );
        for (const channel of CHANNELS) {
          const ids = registry.list(channel).map((p) => p.id);
          logger.log(
            ids.length > 0
              ? `${channel}: ${ids.join(' → ')}${ids.length > 1 ? ' (failover order)' : ''}`
              : `${channel}: disabled (no providers configured)`,
          );
        }
        return registry;
      },
    },
  ],
  exports: [ProviderRegistry],
})
export class ProvidersModule implements OnApplicationShutdown {
  constructor(private readonly registry: ProviderRegistry) {}

  /** Close pooled SMTP connections etc., after in-flight jobs have finished. */
  async onApplicationShutdown(): Promise<void> {
    await this.registry.close();
  }
}

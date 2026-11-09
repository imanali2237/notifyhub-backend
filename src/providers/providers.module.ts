import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHANNELS } from '../channels/channels.constants.js';
import type { Env } from '../config/env.js';
import { ProviderRegistry } from './provider.registry.js';
import { buildEnabledProviders } from './providers.catalog.js';

const logger = new Logger('Providers');

/**
 * Builds the ProviderRegistry from .env (EMAIL_PROVIDERS, ...): only the
 * providers the operator listed, in failover order. A channel with none is
 * disabled. Used by the worker (notifications) and the API (OTP emails,
 * rejecting disabled channels).
 */
@Module({
  providers: [
    {
      provide: ProviderRegistry,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const registry = new ProviderRegistry(buildEnabledProviders(config));
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
export class ProvidersModule {}

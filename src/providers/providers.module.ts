import { Module, type Type } from '@nestjs/common';
import { SmtpEmailProvider } from './email/smtp-email.provider.js';
import { ProviderRegistry } from './provider.registry.js';
import type { ChannelProvider } from './providers.interfaces.js';

/**
 * Every built-in provider. Adding a provider = write one class + add it here.
 * Nothing else in the codebase changes.
 */
const BUILT_IN_PROVIDERS: Type<ChannelProvider>[] = [
  SmtpEmailProvider,
  // BrevoEmailProvider, ConsoleSmsProvider, TextbeeSmsProvider, TelegramProvider...
];

@Module({
  providers: [
    ...BUILT_IN_PROVIDERS,
    {
      provide: ProviderRegistry,
      // Nest creates each provider (with its own dependencies), then hands them all here.
      useFactory: (...providers: ChannelProvider[]) =>
        new ProviderRegistry(providers),
      inject: BUILT_IN_PROVIDERS,
    },
  ],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}

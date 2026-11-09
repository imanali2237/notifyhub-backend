import type { Channel } from '../channels/channels.constants.js';
import type {
  ChannelProvider,
  DispatchResult,
  FailedAttempt,
} from './providers.interfaces.js';

/**
 * Holds the providers the operator enabled, per channel, in failover order
 * (the order of EMAIL_PROVIDERS in .env), and sends through them.
 *
 * A channel with no providers is disabled.
 */
export class ProviderRegistry {
  private readonly byChannel = new Map<Channel, ChannelProvider[]>();

  /** `providers` must already be in failover order. */
  constructor(providers: ChannelProvider[]) {
    for (const provider of providers) {
      const list = this.byChannel.get(provider.channel) ?? [];
      list.push(provider);
      this.byChannel.set(provider.channel, list);
    }
  }

  /** false → the operator configured no provider for this channel. */
  isEnabled(channel: Channel): boolean {
    return this.list(channel).length > 0;
  }

  list(channel: Channel): readonly ChannelProvider[] {
    return this.byChannel.get(channel) ?? [];
  }

  /**
   * Tries each provider in order until one succeeds (failover):
   *  - temporary / provider failure → try the next provider
   *  - message failure (e.g. recipient doesn't exist) → stop, others would fail too
   */
  async send(channel: Channel, message: unknown): Promise<DispatchResult> {
    const providers = this.list(channel);
    if (providers.length === 0) {
      return {
        success: false,
        retryable: false,
        error: `No provider configured for the ${channel} channel`,
        failedAttempts: [],
      };
    }

    const failedAttempts: FailedAttempt[] = [];
    for (const provider of providers) {
      // Providers shouldn't throw, but a bug in one must not skip the others.
      const result = await provider.send(message).catch((err: unknown) => ({
        success: false as const,
        failure: 'temporary' as const,
        error: err instanceof Error ? err.message : String(err),
      }));

      if (result.success) {
        return {
          success: true,
          providerId: provider.id,
          providerMessageId: result.providerMessageId,
          failedAttempts,
        };
      }

      failedAttempts.push({
        providerId: provider.id,
        failure: result.failure,
        error: result.error,
      });
      if (result.failure === 'message') break;
    }

    // A rejected message is final; otherwise retry later only if some provider
    // failed temporarily (bad credentials won't fix themselves in a few seconds).
    const rejected = failedAttempts.at(-1)?.failure === 'message';
    return {
      success: false,
      retryable:
        !rejected && failedAttempts.some((a) => a.failure === 'temporary'),
      error: failedAttempts
        .map((a) => `${a.providerId}: ${a.error}`)
        .join('; '),
      failedAttempts,
    };
  }
}

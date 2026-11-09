import type { Channel } from '../channels/channels.constants.js';
import type { ChannelProvider } from './providers.interfaces.js';

/**
 * Holds every registered provider and picks one for a channel.
 *
 * Today: the first provider registered for the channel.
 * Later (Phase 3): the tenant's configured providers, by priority, with failover.
 */
export class ProviderRegistry {
  private readonly byChannel = new Map<Channel, ChannelProvider[]>();

  constructor(providers: ChannelProvider[]) {
    for (const provider of providers) {
      const list = this.byChannel.get(provider.channel) ?? [];
      list.push(provider);
      this.byChannel.set(provider.channel, list);
    }
  }

  resolve(channel: Channel): ChannelProvider {
    const provider = this.byChannel.get(channel)?.[0];
    if (!provider) {
      throw new Error(`No provider registered for channel "${channel}"`);
    }
    return provider;
  }

  list(channel: Channel): readonly ChannelProvider[] {
    return this.byChannel.get(channel) ?? [];
  }
}

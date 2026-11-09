import { ProviderRegistry } from './provider.registry.js';
import type { ChannelProvider } from './providers.interfaces.js';

const fake = (id: string): ChannelProvider => ({
  id,
  channel: 'email',
  send: () => Promise.resolve({ success: true }),
});

describe('ProviderRegistry', () => {
  it('resolves the first provider registered for a channel', () => {
    const registry = new ProviderRegistry([fake('smtp'), fake('brevo')]);
    expect(registry.resolve('email').id).toBe('smtp');
    expect(registry.list('email').map((p) => p.id)).toEqual(['smtp', 'brevo']);
  });

  it('throws a clear error when a channel has no provider', () => {
    expect(() => new ProviderRegistry([]).resolve('email')).toThrow(
      'No provider registered for channel "email"',
    );
  });
});

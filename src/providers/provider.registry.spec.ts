import { ProviderRegistry } from './provider.registry.js';
import type {
  ChannelProvider,
  SendFailureKind,
  SendResult,
} from './providers.interfaces.js';

/** A fake email provider that records calls and returns a fixed result. */
const fake = (id: string, result: SendResult) => {
  const calls: unknown[] = [];
  const provider: ChannelProvider = {
    id,
    channel: 'email',
    send: (message) => {
      calls.push(message);
      return Promise.resolve(result);
    },
  };
  return { provider, calls };
};
const ok = (id: string) => fake(id, { success: true, providerMessageId: id });
const failing = (id: string, failure: SendFailureKind) =>
  fake(id, { success: false, failure, error: `${id} broke` });

describe('ProviderRegistry', () => {
  it('lists providers per channel in the configured order', () => {
    const registry = new ProviderRegistry([
      ok('brevo').provider,
      ok('smtp').provider,
    ]);
    expect(registry.list('email').map((p) => p.id)).toEqual(['brevo', 'smtp']);
    expect(registry.isEnabled('email')).toBe(true);
  });

  it('a channel without providers is disabled and cannot send', async () => {
    const registry = new ProviderRegistry([]);
    expect(registry.isEnabled('email')).toBe(false);
    expect(await registry.send('email', {})).toEqual({
      success: false,
      retryable: false,
      error: 'No provider configured for the email channel',
      failedAttempts: [],
    });
  });

  it('uses the first provider when it works (others untouched)', async () => {
    const first = ok('brevo');
    const second = ok('smtp');
    const result = await new ProviderRegistry([
      first.provider,
      second.provider,
    ]).send('email', { to: 'a@b.c' });

    expect(result).toMatchObject({ success: true, providerId: 'brevo' });
    expect(second.calls).toHaveLength(0);
  });

  it.each(['temporary', 'provider'] as const)(
    'fails over to the next provider on a %s failure',
    async (failure) => {
      const result = await new ProviderRegistry([
        failing('brevo', failure).provider,
        ok('smtp').provider,
      ]).send('email', {});

      expect(result).toEqual({
        success: true,
        providerId: 'smtp',
        providerMessageId: 'smtp',
        failedAttempts: [
          { providerId: 'brevo', failure, error: 'brevo broke' },
        ],
      });
    },
  );

  it('stops on a message failure: other providers would reject it too', async () => {
    const next = ok('smtp');
    const result = await new ProviderRegistry([
      failing('brevo', 'message').provider,
      next.provider,
    ]).send('email', {});

    expect(result).toMatchObject({ success: false, retryable: false });
    expect(next.calls).toHaveLength(0);
  });

  it('all failed, one temporarily → retry later, with every error listed', async () => {
    const result = await new ProviderRegistry([
      failing('brevo', 'provider').provider,
      failing('smtp', 'temporary').provider,
    ]).send('email', {});

    expect(result).toMatchObject({
      success: false,
      retryable: true,
      error: 'brevo: brevo broke; smtp: smtp broke',
    });
  });

  it('all failed for provider reasons only (e.g. bad keys) → no retry', async () => {
    const result = await new ProviderRegistry([
      failing('brevo', 'provider').provider,
      failing('smtp', 'provider').provider,
    ]).send('email', {});
    expect(result).toMatchObject({ success: false, retryable: false });
  });

  it('a temporary failure then a rejected message → final, no retry', async () => {
    const result = await new ProviderRegistry([
      failing('brevo', 'temporary').provider,
      failing('smtp', 'message').provider,
    ]).send('email', {});
    expect(result).toMatchObject({ success: false, retryable: false });
  });

  it('a provider that throws counts as a temporary failure', async () => {
    const broken: ChannelProvider = {
      id: 'buggy',
      channel: 'email',
      send: () => Promise.reject(new Error('boom')),
    };
    const result = await new ProviderRegistry([
      broken,
      ok('smtp').provider,
    ]).send('email', {});
    expect(result).toMatchObject({
      success: true,
      providerId: 'smtp',
      failedAttempts: [{ providerId: 'buggy', failure: 'temporary' }],
    });
  });
});

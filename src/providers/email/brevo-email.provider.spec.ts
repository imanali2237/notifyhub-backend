import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import {
  BrevoEmailProvider,
  classifyBrevoStatus,
} from './brevo-email.provider.js';
import { BREVO_SEND_URL } from './email-provider.constants.js';

const settings: Partial<Env> = {
  BREVO_API_KEY: 'test-key',
  BREVO_FROM: 'NotifyHub <no-reply@example.com>',
  BREVO_TIMEOUT_MS: 1000,
};
const config = {
  get: (key: keyof Env) => settings[key],
} as unknown as ConfigService<Env, true>;

const message = {
  to: 'sara@example.com',
  subject: 'Hi',
  html: '<p>Hello</p>',
  text: 'Hello',
};

const respond = (status: number, body: unknown) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('BrevoEmailProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the right request and returns Brevo’s message id', async () => {
    const fetchMock = respond(201, { messageId: '<abc@brevo>' });

    const result = await new BrevoEmailProvider(config).send(message);

    expect(result).toEqual({ success: true, providerMessageId: '<abc@brevo>' });
    const [url, init = {}] = fetchMock.mock.calls[0];
    expect(url).toBe(BREVO_SEND_URL);
    const headers = init.headers as Record<string, string>;
    expect(headers['api-key']).toBe('test-key');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'NotifyHub', email: 'no-reply@example.com' },
      to: [{ email: 'sara@example.com' }],
      subject: 'Hi',
      htmlContent: '<p>Hello</p>',
      textContent: 'Hello',
    });
  });

  it('reports an API error with Brevo’s message', async () => {
    respond(401, { code: 'unauthorized', message: 'Key not found' });
    expect(await new BrevoEmailProvider(config).send(message)).toEqual({
      success: false,
      failure: 'provider',
      error: 'Brevo 401: Key not found',
    });
  });

  it('a network error is temporary', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    expect(await new BrevoEmailProvider(config).send(message)).toMatchObject({
      success: false,
      failure: 'temporary',
    });
  });

  it.each([
    [429, 'temporary'],
    [500, 'temporary'],
    [503, 'temporary'],
    [400, 'provider'],
    [401, 'provider'],
    [402, 'provider'],
    [403, 'provider'],
  ] as const)('HTTP %i → %s', (status, expected) => {
    expect(classifyBrevoStatus(status)).toBe(expected);
  });
});

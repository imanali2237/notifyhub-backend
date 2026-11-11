import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { InboxTokenService } from './inbox-token.service.js';

const JWT_SECRET = 'x'.repeat(32);
const makeService = (expiresIn = '12h') => {
  const settings: Partial<Env> = {
    JWT_SECRET,
    INBOX_TOKEN_EXPIRES_IN: expiresIn,
  };
  const config = {
    get: (key: keyof Env) => settings[key],
  } as unknown as ConfigService<Env, true>;
  return new InboxTokenService(new JwtService({}), config);
};
const tenant = { tenantId: 't1', environment: 'live' as const };

describe('InboxTokenService', () => {
  it('a token verifies back to its subscriber, tenant and environment', async () => {
    const service = makeService();
    const { token, expiresAt } = await service.issue(tenant, 'user_1');

    const result = await service.verify(token);
    expect(result.subscriber).toEqual({ ...tenant, subscriberId: 'user_1' });
    expect(result.expiresAt).toEqual(expiresAt);
    const hours = (expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThanOrEqual(12);
  });

  it('rejects a dashboard login token signed with JWT_SECRET', async () => {
    const dashboardToken = await new JwtService({
      secret: JWT_SECRET,
    }).signAsync({ sub: 'user_1', tid: 't1', env: 'live' });

    await expect(makeService().verify(dashboardToken)).rejects.toThrow();
  });

  it('and a subscriber token is not a valid dashboard token', async () => {
    const { token } = await makeService().issue(tenant, 'user_1');
    await expect(
      new JwtService({ secret: JWT_SECRET }).verifyAsync(token),
    ).rejects.toThrow(/invalid signature/);
  });

  it('rejects a tampered token', async () => {
    const service = makeService();
    const { token } = await service.issue(tenant, 'user_1');
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'someone_else', tid: 't1', env: 'live' }),
    ).toString('base64url');

    await expect(
      service.verify(`${header}.${forged}.${signature}`),
    ).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const service = makeService('1s');
    const { token } = await service.issue(tenant, 'user_1');
    vi.useFakeTimers({ now: Date.now() + 5_000 });
    try {
      await expect(service.verify(token)).rejects.toThrow(/expired/);
    } finally {
      vi.useRealTimers();
    }
  });
});

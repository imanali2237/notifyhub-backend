import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { ApiKeyEnvironment } from '../generated/prisma/client.js';
import {
  INBOX_TOKEN_AUDIENCE,
  INBOX_TOKEN_KEY_LABEL,
} from './inbox.constants.js';
import type {
  InboxTokenPayload,
  SubscriberContext,
} from './inbox.interfaces.js';

type JwtExpiresIn = NonNullable<
  Parameters<JwtService['signAsync']>[1]
>['expiresIn'];

/**
 * Subscriber tokens: how the inbox UI in a BROWSER proves which user it is.
 *
 * The browser must never hold an API key. Instead, your backend (which has the
 * key) asks for a short-lived token for one subscriber and hands it to the
 * page; the page uses it for the inbox REST API and the WebSocket.
 */
@Injectable()
export class InboxTokenService {
  private readonly key: string;
  private readonly expiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    // Own signing key, derived from JWT_SECRET (see INBOX_TOKEN_KEY_LABEL).
    this.key = createHmac('sha256', config.get('JWT_SECRET'))
      .update(INBOX_TOKEN_KEY_LABEL)
      .digest('hex');
    this.expiresIn = config.get('INBOX_TOKEN_EXPIRES_IN');
  }

  async issue(
    tenant: { tenantId: string; environment: ApiKeyEnvironment },
    subscriberId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const payload: InboxTokenPayload = {
      sub: subscriberId,
      tid: tenant.tenantId,
      env: tenant.environment,
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.key,
      audience: INBOX_TOKEN_AUDIENCE,
      expiresIn: this.expiresIn as JwtExpiresIn,
    });
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  /** Throws if the token is invalid, expired or not a subscriber token. */
  async verify(
    token: string,
  ): Promise<{ subscriber: SubscriberContext; expiresAt: Date }> {
    const payload = await this.jwt.verifyAsync<
      InboxTokenPayload & { exp: number }
    >(token, { secret: this.key, audience: INBOX_TOKEN_AUDIENCE });
    return {
      subscriber: {
        tenantId: payload.tid,
        environment: payload.env,
        subscriberId: payload.sub,
      },
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}

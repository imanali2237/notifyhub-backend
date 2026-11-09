import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';
import { REDIS } from '../redis/redis.constants.js';
import {
  OTP_KEY_PREFIX,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
} from './otp.constants.js';
import type { OtpCheck, OtpPurpose } from './otp.interfaces.js';
import { CHECK_OTP_SCRIPT } from './otp.scripts.js';

/**
 * Redis layout (per purpose + identifier, e.g. an email):
 *   otp:{purpose}:{id}           HASH { hash, attempts }   TTL 15 min
 *   otp:{purpose}:{id}:cooldown  "1"                       TTL 60 s
 *
 * Only an HMAC of the code is stored, never the code itself.
 */
@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('OTP_SECRET');
  }

  /** Creates a new code (replacing any previous one) and returns it so it can be emailed. */
  async issue(purpose: OtpPurpose, id: string): Promise<string> {
    // SET ... NX only succeeds if the key doesn't exist → simple per-identifier cooldown.
    const allowed = await this.redis.set(
      this.cooldownKey(purpose, id),
      '1',
      'EX',
      OTP_RESEND_COOLDOWN_SECONDS,
      'NX',
    );
    if (!allowed) {
      throw new HttpException(
        `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    const key = this.key(purpose, id);
    await this.redis
      .multi()
      .del(key) // a new code invalidates the old one
      .hset(key, { hash: this.hash(purpose, id, code), attempts: 0 })
      .expire(key, OTP_TTL_SECONDS)
      .exec();

    return code;
  }

  /** Checks a code. A valid code is deleted, so it can only be used once. */
  async verify(
    purpose: OtpPurpose,
    id: string,
    code: string,
  ): Promise<OtpCheck> {
    const key = this.key(purpose, id);
    const result = (await this.redis.eval(CHECK_OTP_SCRIPT, 1, key)) as
      [number, string] | null;

    if (!result) return 'expired';

    const [attempts, storedHash] = result;
    if (attempts > OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      return 'too_many_attempts';
    }

    // Constant-time comparison: response time doesn't leak how many characters matched.
    const expected = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(this.hash(purpose, id, code), 'hex');
    if (!timingSafeEqual(expected, actual)) return 'invalid';

    await this.redis.del(key, this.cooldownKey(purpose, id));
    return 'valid';
  }

  /** Crypto-secure random code, zero-padded: e.g. "004217". */
  private generateCode(): string {
    return randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
  }

  /**
   * HMAC-SHA256 with a server secret — not a plain SHA-256. A 6-digit code has only
   * 1,000,000 possibilities, so a plain hash leaked from Redis could be reversed in
   * milliseconds. Without OTP_SECRET, the hash is useless to an attacker.
   * Purpose + id are mixed in so a hash can't be replayed for another email.
   */
  private hash(purpose: OtpPurpose, id: string, code: string): string {
    return createHmac('sha256', this.secret)
      .update(`${purpose}:${id}:${code}`)
      .digest('hex');
  }

  private key(purpose: OtpPurpose, id: string): string {
    return `${OTP_KEY_PREFIX}:${purpose}:${id}`;
  }

  private cooldownKey(purpose: OtpPurpose, id: string): string {
    return `${this.key(purpose, id)}:cooldown`;
  }
}

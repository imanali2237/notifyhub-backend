import { createHash, randomBytes } from 'node:crypto';
import type { ApiKeyEnvironment } from '../../generated/prisma/client.js';
import {
  API_KEY_BRAND_PREFIX,
  API_KEY_DISPLAY_PREFIX_LENGTH,
  API_KEY_RANDOM_BYTES,
} from '../api-keys.constants.js';
import type { GeneratedApiKey } from '../api-keys.interfaces.js';

/**
 * Generates a new key like `nh_live_Xk3v9QmP2rT8wLz1bN5cY7hJ4dF6gS0a`.
 *
 * - `nh_`         → anyone (and secret scanners like GitHub's) can tell it's a NotifyHub key
 * - `live_/test_` → which environment, visible at a glance
 * - 192 random bits, base64url → impossible to guess, safe in URLs and headers
 */
export function generateApiKey(
  environment: ApiKeyEnvironment,
): GeneratedApiKey {
  const random = randomBytes(API_KEY_RANDOM_BYTES).toString('base64url');
  const key = `${API_KEY_BRAND_PREFIX}${environment}_${random}`;
  return {
    key,
    prefix: key.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
    hash: hashApiKey(key),
  };
}

/**
 * Plain SHA-256 is right here (unlike passwords, which use slow argon2):
 * the key is 192 random bits, so there is nothing to brute-force, and it's
 * checked on EVERY API request, so it must be fast. It's also deterministic,
 * so we can find the key with a unique-index lookup: WHERE key_hash = ?
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

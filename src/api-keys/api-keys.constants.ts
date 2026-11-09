/** Header the SDK sends the key in. (Express lowercases all header names.) */
export const API_KEY_HEADER = 'x-api-key';

/** Every NotifyHub key starts with this → nh_live_... / nh_test_... */
export const API_KEY_BRAND_PREFIX = 'nh_';

/** Random bytes in a key: 24 bytes = 192 bits → 32 base64url characters. */
export const API_KEY_RANDOM_BYTES = 24;

/** Characters kept in plain text for display: "nh_live_" (8) + first 8 random chars. */
export const API_KEY_DISPLAY_PREFIX_LENGTH = 16;

/** Stops a leaked dashboard session from minting thousands of keys. */
export const MAX_ACTIVE_KEYS_PER_TENANT = 20;

/** Only write last_used_at if it's older than this — avoids a DB write on every request. */
export const LAST_USED_UPDATE_INTERVAL_MS = 60_000;

/** Columns that are safe to return from the API. Never keyHash. */
export const API_KEY_PUBLIC_SELECT = {
  id: true,
  name: true,
  environment: true,
  prefix: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

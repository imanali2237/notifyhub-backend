import { z } from 'zod';
import { DEFAULTS } from './config.defaults.js';

// Small helpers so every setting reads the same way.
const int = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
// z.stringbool() parses "true"/"false"/"1"/"0" correctly.
// (z.coerce.boolean() would turn the string "false" into true!)
const bool = (fallback: boolean) => z.stringbool().default(fallback);
/** Optional string where an empty value in .env (FOO=) means "not set". */
const optionalString = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Every environment variable the app reads, validated once at startup (API and
 * worker). Required settings have no default; optional ones fall back to
 * config.defaults.ts. If something is malformed, the app refuses to boot with a
 * clear error instead of failing later with a confusing one.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: int(DEFAULTS.PORT),

  // ── Databases (required) ──
  DATABASE_URL: z.url(),
  MONGO_URI: z.url(),

  // ── Redis ──
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: optionalString(),
  REDIS_COMMAND_TIMEOUT_MS: int(DEFAULTS.REDIS_COMMAND_TIMEOUT_MS),

  // ── SMTP (Mailpit locally; Gmail/Brevo/etc. in production) ──
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),
  SMTP_SECURE: bool(DEFAULTS.SMTP_SECURE),
  SMTP_USER: optionalString(), // leave empty for Mailpit (no auth)
  SMTP_PASS: optionalString(),
  SMTP_CONNECTION_TIMEOUT_MS: int(DEFAULTS.SMTP_CONNECTION_TIMEOUT_MS),
  SMTP_SOCKET_TIMEOUT_MS: int(DEFAULTS.SMTP_SOCKET_TIMEOUT_MS),

  // ── Secrets (required) ──
  // Secret key for HMAC-hashing OTP codes before they are stored in Redis.
  OTP_SECRET: z.string().min(32, 'OTP_SECRET must be at least 32 characters'),
  // Secret for signing login tokens (JWTs). Changing it logs everyone out.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // ── Auth ──
  JWT_EXPIRES_IN: z.string().default(DEFAULTS.JWT_EXPIRES_IN), // e.g. 15m, 8h, 7d
  // true  → new users must enter an emailed OTP before they can log in (needs SMTP)
  // false → no OTP; users can log in right after signup (typical for self-hosting)
  EMAIL_VERIFICATION_REQUIRED: bool(DEFAULTS.EMAIL_VERIFICATION_REQUIRED),
  // true  → anyone who can reach the dashboard can create an account
  // false → only the very first account can be created (the admin), then signup closes
  SIGNUP_ENABLED: bool(DEFAULTS.SIGNUP_ENABLED),

  // ── OTP ──
  OTP_TTL_SECONDS: int(DEFAULTS.OTP_TTL_SECONDS),
  OTP_MAX_ATTEMPTS: int(DEFAULTS.OTP_MAX_ATTEMPTS),
  OTP_RESEND_COOLDOWN_SECONDS: int(DEFAULTS.OTP_RESEND_COOLDOWN_SECONDS),

  // ── Queues ──
  QUEUE_MAX_ATTEMPTS: int(DEFAULTS.QUEUE_MAX_ATTEMPTS),
  QUEUE_BACKOFF_DELAY_MS: int(DEFAULTS.QUEUE_BACKOFF_DELAY_MS),
  QUEUE_KEEP_COMPLETED_SECONDS: int(DEFAULTS.QUEUE_KEEP_COMPLETED_SECONDS),
  QUEUE_KEEP_COMPLETED_COUNT: int(DEFAULTS.QUEUE_KEEP_COMPLETED_COUNT),
  QUEUE_KEEP_FAILED_SECONDS: int(DEFAULTS.QUEUE_KEEP_FAILED_SECONDS),
  QUEUE_ENQUEUE_TIMEOUT_MS: int(DEFAULTS.QUEUE_ENQUEUE_TIMEOUT_MS),

  // ── Workers ──
  EMAIL_WORKER_CONCURRENCY: int(DEFAULTS.EMAIL_WORKER_CONCURRENCY),

  // ── Trigger API ──
  IDEMPOTENCY_TTL_SECONDS: int(DEFAULTS.IDEMPOTENCY_TTL_SECONDS),

  // ── API keys ──
  API_KEYS_MAX_ACTIVE_PER_TENANT: int(DEFAULTS.API_KEYS_MAX_ACTIVE_PER_TENANT),

  // ── Health ──
  HEALTH_PROBE_TIMEOUT_MS: int(DEFAULTS.HEALTH_PROBE_TIMEOUT_MS),

  // ── API docs ──
  SWAGGER_ENABLED: bool(DEFAULTS.SWAGGER_ENABLED),
  SWAGGER_PATH: z
    .string()
    .regex(/^[a-z0-9-/]+$/, 'SWAGGER_PATH may only contain a-z, 0-9, - and /')
    .default(DEFAULTS.SWAGGER_PATH),

  // ── Queue dashboard (Bull Board) ──
  BULL_BOARD_ENABLED: bool(DEFAULTS.BULL_BOARD_ENABLED),
  BULL_BOARD_PATH: z
    .string()
    .regex(
      /^[a-z0-9-/]+$/,
      'BULL_BOARD_PATH may only contain a-z, 0-9, - and /',
    )
    .default(DEFAULTS.BULL_BOARD_PATH),
  BULL_BOARD_USERNAME: z.string().min(1).default(DEFAULTS.BULL_BOARD_USERNAME),
  // Set → dashboard asks for username + password (browser login prompt).
  // Not set → open without login in development; NOT mounted in production.
  BULL_BOARD_PASSWORD: optionalString(),
  BULL_BOARD_READ_ONLY: bool(DEFAULTS.BULL_BOARD_READ_ONLY),
});

export type Env = z.infer<typeof envSchema>;

/** Plugged into ConfigModule.forRoot({ validate }). */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

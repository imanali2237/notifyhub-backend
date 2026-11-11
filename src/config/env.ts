import { z } from 'zod';
import { parseFromAddress } from '../common/utils/parse-from-address.js';
import {
  EMAIL_PROVIDER_IDS,
  EMAIL_PROVIDER_REQUIRED_SETTINGS,
} from '../providers/email/email-provider.constants.js';
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
/** Optional number where an empty value in .env (FOO=) means "not set". */
const optionalInt = () =>
  z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  );
/**
 * Comma-separated list of provider ids, e.g. "brevo,smtp" → ['brevo', 'smtp'].
 * Order matters (failover order). Empty → [] (channel disabled).
 */
const providerList = <const T extends readonly [string, ...string[]]>(ids: T) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.enum(ids))
        .refine((list) => new Set(list).size === list.length, {
          message: 'a provider is listed more than once',
        }),
    );

/**
 * Every environment variable the app reads, validated once at startup (API and
 * worker). Required settings have no default; optional ones fall back to
 * config.defaults.ts. If something is malformed, the app refuses to boot with a
 * clear error instead of failing later with a confusing one.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: int(DEFAULTS.PORT),
    // Websites allowed to call the API from a browser (the in-app inbox UI):
    // "*" = any, or a comma-separated list: "https://app.example.com,http://localhost:5173"
    CORS_ORIGINS: z
      .preprocess((v) => (v === '' ? undefined : v), z.string().optional())
      .transform((v) => v ?? DEFAULTS.CORS_ORIGINS)
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(
            z
              .string()
              .refine((o) => o === '*' || /^https?:\/\/[^/]+$/.test(o), {
                message:
                  'each origin must look like https://app.example.com (no path, no trailing slash) or be *',
              }),
          )
          .min(1),
      ),

    // ── Databases (required) ──
    DATABASE_URL: z.url(),
    MONGO_URI: z.url(),

    // ── Redis ──
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().positive(),
    REDIS_PASSWORD: optionalString(),
    REDIS_COMMAND_TIMEOUT_MS: int(DEFAULTS.REDIS_COMMAND_TIMEOUT_MS),

    // ── Email providers ──
    // Which providers send email, in failover order: "smtp", "brevo,smtp"...
    // Empty → the email channel is disabled.
    EMAIL_PROVIDERS: providerList(EMAIL_PROVIDER_IDS),

    // SMTP (Mailpit locally; Gmail, Outlook, any SMTP server in production).
    // Required when EMAIL_PROVIDERS includes "smtp".
    SMTP_HOST: optionalString(),
    SMTP_PORT: optionalInt(),
    SMTP_FROM: optionalString(),
    SMTP_SECURE: bool(DEFAULTS.SMTP_SECURE),
    SMTP_USER: optionalString(), // leave empty for Mailpit (no auth)
    SMTP_PASS: optionalString(),
    SMTP_CONNECTION_TIMEOUT_MS: int(DEFAULTS.SMTP_CONNECTION_TIMEOUT_MS),
    SMTP_SOCKET_TIMEOUT_MS: int(DEFAULTS.SMTP_SOCKET_TIMEOUT_MS),
    // Keep connections open and reuse them (much faster for many emails).
    SMTP_POOL: bool(DEFAULTS.SMTP_POOL),
    SMTP_MAX_CONNECTIONS: int(DEFAULTS.SMTP_MAX_CONNECTIONS),
    SMTP_MAX_MESSAGES: int(DEFAULTS.SMTP_MAX_MESSAGES),

    // Brevo (REST API). Required when EMAIL_PROVIDERS includes "brevo".
    BREVO_API_KEY: optionalString(),
    BREVO_FROM: optionalString(), // a sender verified in your Brevo account
    BREVO_TIMEOUT_MS: int(DEFAULTS.BREVO_TIMEOUT_MS),

    // ── In-app inbox ──
    // false → the in_app channel is disabled (no inbox, no WebSocket updates)
    IN_APP_ENABLED: bool(DEFAULTS.IN_APP_ENABLED),
    // How long a subscriber token (POST /v1/inbox/tokens) works: 15m, 12h, 7d...
    INBOX_TOKEN_EXPIRES_IN: z
      .string()
      .regex(
        /^\d+[smhd]$/,
        'INBOX_TOKEN_EXPIRES_IN must look like 15m, 12h or 7d',
      )
      .default(DEFAULTS.INBOX_TOKEN_EXPIRES_IN),

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
    IN_APP_WORKER_CONCURRENCY: int(DEFAULTS.IN_APP_WORKER_CONCURRENCY),

    // ── Trigger API ──
    IDEMPOTENCY_TTL_SECONDS: int(DEFAULTS.IDEMPOTENCY_TTL_SECONDS),

    // ── API keys ──
    API_KEYS_MAX_ACTIVE_PER_TENANT: int(
      DEFAULTS.API_KEYS_MAX_ACTIVE_PER_TENANT,
    ),

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
    BULL_BOARD_USERNAME: z
      .string()
      .min(1)
      .default(DEFAULTS.BULL_BOARD_USERNAME),
    // Set → dashboard asks for username + password (browser login prompt).
    // Not set → open without login in development; NOT mounted in production.
    BULL_BOARD_PASSWORD: optionalString(),
    BULL_BOARD_READ_ONLY: bool(DEFAULTS.BULL_BOARD_READ_ONLY),
  })
  .superRefine((env, ctx) => {
    // Every listed provider needs its own settings.
    for (const id of env.EMAIL_PROVIDERS) {
      for (const key of EMAIL_PROVIDER_REQUIRED_SETTINGS[id]) {
        if (env[key] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required because EMAIL_PROVIDERS includes "${id}"`,
          });
        }
      }
    }

    for (const key of ['SMTP_FROM', 'BREVO_FROM'] as const) {
      const value = env[key];
      if (value !== undefined && !parseFromAddress(value)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} must look like "Name <you@example.com>" or "you@example.com"`,
        });
      }
    }

    // Verification codes are sent by email, so email must be enabled.
    if (env.EMAIL_VERIFICATION_REQUIRED && env.EMAIL_PROVIDERS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDERS'],
        message:
          'EMAIL_VERIFICATION_REQUIRED=true needs at least one email provider (e.g. EMAIL_PROVIDERS=smtp)',
      });
    }
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

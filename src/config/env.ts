import { z } from 'zod';

/**
 * Every environment variable the app needs, validated once at startup.
 * If something is missing or malformed, the app refuses to boot with a clear error
 * instead of failing later with a confusing connection error.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.url(),
  MONGO_URI: z.url(),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),

  // Secret key for HMAC-hashing OTP codes before they are stored in Redis.
  OTP_SECRET: z.string().min(32, 'OTP_SECRET must be at least 32 characters'),

  // Secret for signing login tokens (JWTs). Changing it logs everyone out.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'), // e.g. 15m, 8h, 7d

  // ── Operator choices (whoever runs this NotifyHub server) ──
  // z.stringbool() parses "true"/"false"/"1"/"0" correctly.
  // (z.coerce.boolean() would turn the string "false" into true!)

  // true  → new users must enter an emailed OTP before they can log in (needs SMTP)
  // false → no OTP; users can log in right after signup (typical for self-hosting)
  EMAIL_VERIFICATION_REQUIRED: z.stringbool().default(false),

  // true  → anyone who can reach the dashboard can create an account
  // false → only the very first account can be created (the admin), then signup closes
  SIGNUP_ENABLED: z.stringbool().default(false),
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

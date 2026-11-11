/**
 * Default value of every OPTIONAL setting. Each one can be overridden in .env;
 * if it isn't set there, this value is used. (Required settings like secrets
 * and database URLs have no default — see env.ts.)
 */
export const DEFAULTS = {
  // ── HTTP ──
  PORT: 3000,
  CORS_ORIGINS: '*', // which websites may call the API from a browser (the inbox UI)

  // ── Auth ──
  JWT_EXPIRES_IN: '8h',
  EMAIL_VERIFICATION_REQUIRED: false,
  SIGNUP_ENABLED: false,

  // ── OTP (email verification codes) ──
  OTP_TTL_SECONDS: 15 * 60, // a code is valid for 15 minutes
  OTP_MAX_ATTEMPTS: 5, // wrong guesses before the code is destroyed
  OTP_RESEND_COOLDOWN_SECONDS: 60, // min gap between two codes

  // ── Redis ──
  REDIS_COMMAND_TIMEOUT_MS: 2000, // fail fast instead of hanging when Redis is down

  // ── SMTP ──
  SMTP_SECURE: false, // true for port 465 (implicit TLS)
  SMTP_CONNECTION_TIMEOUT_MS: 10_000,
  SMTP_SOCKET_TIMEOUT_MS: 20_000,
  SMTP_POOL: true, // reuse open connections instead of one new connection per email
  SMTP_MAX_CONNECTIONS: 5, // open connections per worker process (when pooling)
  SMTP_MAX_MESSAGES: 100, // emails per connection before it is replaced (when pooling)

  // ── Brevo ──
  BREVO_TIMEOUT_MS: 10_000, // max wait for Brevo's API before trying the next provider

  // ── Queues (BullMQ) ──
  QUEUE_MAX_ATTEMPTS: 5, // 1 try + 4 retries
  QUEUE_BACKOFF_DELAY_MS: 2000, // exponential: 2s, 4s, 8s, 16s
  QUEUE_KEEP_COMPLETED_SECONDS: 24 * 60 * 60, // forget successful jobs after 1 day
  QUEUE_KEEP_COMPLETED_COUNT: 1000, // ...or once there are more than this
  QUEUE_KEEP_FAILED_SECONDS: 7 * 24 * 60 * 60, // dead letter queue kept 7 days
  QUEUE_ENQUEUE_TIMEOUT_MS: 3000, // max wait for Redis when adding a job

  // ── Workers ──
  EMAIL_WORKER_CONCURRENCY: 5, // emails sent in parallel per worker process
  IN_APP_WORKER_CONCURRENCY: 10, // in-app messages saved in parallel per worker process

  // ── In-app inbox ──
  IN_APP_ENABLED: true,
  INBOX_TOKEN_EXPIRES_IN: '12h', // how long a subscriber token works

  // ── Trigger API ──
  IDEMPOTENCY_TTL_SECONDS: 24 * 60 * 60, // same idempotencyKey within this = duplicate

  // ── API keys ──
  API_KEYS_MAX_ACTIVE_PER_TENANT: 20,

  // ── Health ──
  HEALTH_PROBE_TIMEOUT_MS: 2000,

  // ── API docs ──
  SWAGGER_ENABLED: true,
  SWAGGER_PATH: 'docs',

  // ── Queue dashboard (Bull Board) ──
  BULL_BOARD_ENABLED: true,
  BULL_BOARD_PATH: 'queues',
  BULL_BOARD_USERNAME: 'admin', // the password has no default: BULL_BOARD_PASSWORD
  BULL_BOARD_READ_ONLY: false, // true = view only, no retry/delete buttons
} as const;

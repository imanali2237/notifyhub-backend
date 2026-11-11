# Configuration reference

NotifyHub is configured entirely through environment variables, usually in a
`.env` file at the project root (start from `.env.example`).

- **Required** settings have no default — NotifyHub won't start without them.
- **Optional** settings fall back to the defaults below (defined in
  `src/config/config.defaults.ts`).
- Everything is **validated at startup** (API and worker). A wrong value stops
  NotifyHub with a message naming the setting, instead of failing later.
- Real environment variables override `.env`. Changes need a **restart**.
- `.env` holds secrets — never commit it. Only `.env.example` belongs in git.
- An empty value (`SMTP_USER=`) counts as "not set".

Booleans accept `true`/`false` (also `1`/`0`, `yes`/`no`).

---

## Server

| Setting | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production`. Affects the queue dashboard's security (see below) |
| `PORT` | `3000` | API port. Swagger, the queue dashboard and the inbox WebSocket are served on it too |
| `CORS_ORIGINS` | `*` | Websites allowed to call the API from a browser (the [in-app inbox](in-app-inbox.md) UI): `*` = any, or a comma-separated list like `https://app.example.com,http://localhost:5173` (no path, no trailing slash). Restrict it in production |

## Databases (required)

| Setting | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://notifyhub:notifyhub@localhost:5432/notifyhub` | PostgreSQL: accounts, tenants, API keys |
| `MONGO_URI` | `mongodb://notifyhub:notifyhub@localhost:27017/notifyhub?authSource=admin` | MongoDB: notifications and their history |

## Redis

| Setting | Default | Description |
|---|---|---|
| `REDIS_HOST` | **required** | e.g. `localhost` |
| `REDIS_PORT` | **required** | e.g. `6379` |
| `REDIS_PASSWORD` | — | Set if your Redis requires a password |
| `REDIS_COMMAND_TIMEOUT_MS` | `2000` | A Redis command that takes longer fails, so requests get `503` instead of hanging when Redis is down |

Redis holds the queues, verification codes and idempotency keys. Use
persistence (AOF, as in the bundled `docker/docker-compose.yml`) so queued
jobs survive a restart.

## Secrets (required)

Generate each with `openssl rand -hex 32`.

| Setting | Rules | Description |
|---|---|---|
| `OTP_SECRET` | min 32 characters | Verification codes are stored hashed with this key |
| `JWT_SECRET` | min 32 characters | Signs login tokens and (through a derived key) inbox subscriber tokens. **Changing it logs everyone out** |

## Accounts and login

| Setting | Default | Description |
|---|---|---|
| `SIGNUP_ENABLED` | `false` | `false`: only the **first** account (the admin) can be created, then signup closes. `true`: anyone who can reach the API can create an account |
| `EMAIL_VERIFICATION_REQUIRED` | `false` | `true`: new accounts must enter a 6-digit code sent by email before logging in. Needs at least one [email provider](email-providers.md) |
| `JWT_EXPIRES_IN` | `8h` | How long a login lasts: `15m`, `8h`, `7d`... |
| `OTP_TTL_SECONDS` | `900` | A verification code is valid for 15 minutes |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong guesses before the code is destroyed |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Minimum time between two codes for the same email |

## API keys

| Setting | Default | Description |
|---|---|---|
| `API_KEYS_MAX_ACTIVE_PER_TENANT` | `20` | Maximum non-revoked keys per tenant |

## Email providers

Full guide: [email-providers.md](email-providers.md).

| Setting | Default | Description |
|---|---|---|
| `EMAIL_PROVIDERS` | empty (email disabled) | Providers in failover order: `smtp`, `brevo`, `brevo,smtp`... |

**SMTP** — required when `EMAIL_PROVIDERS` includes `smtp`:

| Setting | Default | Description |
|---|---|---|
| `SMTP_HOST` | required for `smtp` | Server address |
| `SMTP_PORT` | required for `smtp` | `465`, `587`, or `1025` (Mailpit) |
| `SMTP_FROM` | required for `smtp` | Sender: `"Name <email>"` or `email` |
| `SMTP_SECURE` | `false` | `true` for port 465 (implicit TLS) |
| `SMTP_USER` | — | Login; empty if the server needs none |
| `SMTP_PASS` | — | Password / app password |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` | Max time to connect |
| `SMTP_SOCKET_TIMEOUT_MS` | `20000` | Max silence on an open connection |
| `SMTP_POOL` | `true` | Keep connections open and reuse them. `false` = a new connection (and login) for every email: much slower |
| `SMTP_MAX_CONNECTIONS` | `5` | Open connections **per worker process** when pooling. Some providers limit simultaneous connections; lower it if you get connection errors |
| `SMTP_MAX_MESSAGES` | `100` | Emails sent over one connection before it is replaced |

**Brevo** — required when `EMAIL_PROVIDERS` includes `brevo`:

| Setting | Default | Description |
|---|---|---|
| `BREVO_API_KEY` | required for `brevo` | API key from Brevo → SMTP & API → API Keys |
| `BREVO_FROM` | required for `brevo` | A sender verified in Brevo: `"Name <email>"` or `email` |
| `BREVO_TIMEOUT_MS` | `10000` | Max wait for Brevo's API before trying the next provider |

## In-app inbox

Full guide: [in-app-inbox.md](in-app-inbox.md).

| Setting | Default | Description |
|---|---|---|
| `IN_APP_ENABLED` | `true` | `false` disables the `in_app` channel (sending and new subscriber tokens get `400`) |
| `INBOX_TOKEN_EXPIRES_IN` | `12h` | How long a subscriber token works: `15m`, `12h`, `7d`... Signed with a key derived from `JWT_SECRET` |

## Sending (trigger API)

| Setting | Default | Description |
|---|---|---|
| `IDEMPOTENCY_TTL_SECONDS` | `86400` | A repeated `idempotencyKey` within this window is a duplicate (24 h) |

## Queues and retries

See [queues-and-workers.md](queues-and-workers.md) for how these interact.

| Setting | Default | Description |
|---|---|---|
| `QUEUE_MAX_ATTEMPTS` | `5` | Total tries per notification (1 + 4 retries). Each try runs through all providers |
| `QUEUE_BACKOFF_DELAY_MS` | `2000` | First retry delay; it doubles each time: 2 s, 4 s, 8 s, 16 s |
| `QUEUE_KEEP_COMPLETED_SECONDS` | `86400` | Finished jobs are removed from Redis after 1 day... |
| `QUEUE_KEEP_COMPLETED_COUNT` | `1000` | ...or once more than this many are kept. (Notifications themselves stay in MongoDB for 30 days) |
| `QUEUE_KEEP_FAILED_SECONDS` | `604800` | Failed jobs (dead-letter queue) are kept 7 days for inspection and manual retry |
| `QUEUE_ENQUEUE_TIMEOUT_MS` | `3000` | If adding a job takes longer, the API answers `503` and saves nothing |

Changes apply to **new** jobs; jobs already queued keep the settings they were created with.

## Workers

| Setting | Default | Description |
|---|---|---|
| `EMAIL_WORKER_CONCURRENCY` | `5` | Emails sent in parallel **per worker process** |
| `IN_APP_WORKER_CONCURRENCY` | `10` | In-app messages saved in parallel **per worker process** |

## Health check

| Setting | Default | Description |
|---|---|---|
| `HEALTH_PROBE_TIMEOUT_MS` | `2000` | Max time each database gets to answer `GET /health` |

## API docs (Swagger)

| Setting | Default | Description |
|---|---|---|
| `SWAGGER_ENABLED` | `true` | Serve interactive API docs |
| `SWAGGER_PATH` | `docs` | URL path → `http://<host>:<PORT>/docs`. Letters, digits, `-` and `/` |

## Queue dashboard (Bull Board)

| Setting | Default | Description |
|---|---|---|
| `BULL_BOARD_ENABLED` | `true` | Serve the queue dashboard |
| `BULL_BOARD_PATH` | `queues` | URL path → `http://<host>:<PORT>/queues` |
| `BULL_BOARD_USERNAME` | `admin` | Login name (when a password is set) |
| `BULL_BOARD_PASSWORD` | — | **Set → browser login required.** Not set → open in `development`, **not served at all** in other environments |
| `BULL_BOARD_READ_ONLY` | `false` | `true` hides retry / delete / clean buttons |

---

## Example: production `.env`

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://notifyhub:<password>@db.internal:5432/notifyhub
MONGO_URI=mongodb://notifyhub:<password>@mongo.internal:27017/notifyhub?authSource=admin
REDIS_HOST=redis.internal
REDIS_PORT=6379
REDIS_PASSWORD=<password>

OTP_SECRET=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>

SIGNUP_ENABLED=false
EMAIL_VERIFICATION_REQUIRED=true

EMAIL_PROVIDERS=brevo,smtp
BREVO_API_KEY=xkeysib-...
BREVO_FROM="My Company <notifications@mycompany.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=alerts@mycompany.com
SMTP_PASS=<app password>
SMTP_FROM="My Company <alerts@mycompany.com>"

BULL_BOARD_PASSWORD=<strong password>
```

Serve NotifyHub behind HTTPS (e.g. a reverse proxy) in production: API keys,
login tokens and the dashboard password travel in request headers.

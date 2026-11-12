# Self-hosting NotifyHub in production

Run NotifyHub on your own server with Docker: one settings file, one command.
Everything runs in containers: the API, the worker, PostgreSQL, MongoDB, Redis,
and optionally Caddy for automatic HTTPS.

(For local development use [Getting started](getting-started.md) instead.)

- [What you need](#1-what-you-need)
- [Get the code](#2-get-the-code)
- [Configure](#3-configure)
- [Start](#4-start)
- [Create the admin account](#5-create-the-admin-account-and-an-api-key)
- [HTTPS](#6-https)
- [Day-to-day operations](#7-day-to-day-operations)
- [Updating](#8-updating)
- [Backups](#9-backups)
- [Security checklist](#10-security-checklist)
- [Troubleshooting](#11-troubleshooting)

## What gets started

| Container | Does | Reachable from outside? |
|---|---|---|
| `api` | REST API, Swagger (`/docs`), queue dashboard (`/queues`), inbox WebSocket (`/inbox`) | Yes, on `API_PORT` (default `3000`) |
| `worker` | Sends notifications. Run several with `--scale worker=3` | No |
| `migrate` | Applies database migrations on every start, then exits. The API waits for it | No |
| `postgres`, `mongo`, `redis` | Data. Stored in Docker volumes, survives restarts and updates | **No**, only inside Docker's private network |
| `caddy` (optional) | HTTPS with automatic certificates | Yes, ports 80 and 443 |

All containers restart automatically after a crash or a reboot, and their
logs are rotated so they can't fill the disk.

## 1. What you need

- A Linux server (any VPS works) with **Docker Engine** and the **Docker
  Compose plugin** (`docker compose version` should print v2.x). Install:
  https://docs.docker.com/engine/install/
- **RAM:** the whole stack uses about **600 MB** when idle (API ~180 MB,
  worker ~110 MB, MongoDB ~120 MB, the rest small). Use at least **1 GB**;
  **2 GB** is comfortable, more if you run extra workers.
- **Disk:** a few GB. Notifications are deleted after 30 days and inbox
  messages after 90, so data stays bounded.
- For HTTPS: a domain name pointing at the server.

## 2. Get the code

```bash
git clone https://github.com/<your-username>/notifyhub.git
cd notifyhub
```

The image is built from this code on your server, so no registry account is
needed.

## 3. Configure

```bash
cp .env.production.example .env.production
```

Open `.env.production` and set at least:

| Setting | How |
|---|---|
| `POSTGRES_PASSWORD`, `MONGO_PASSWORD`, `REDIS_PASSWORD` | `openssl rand -hex 24` each. **Letters and digits only.** Set them **before the first start**: the databases are created with these passwords (see [troubleshooting](#changed-a-database-password-after-the-first-start)) |
| `OTP_SECRET`, `JWT_SECRET` | `openssl rand -hex 32` each |
| `CORS_ORIGINS` | Your app's address, e.g. `https://app.example.com` (needed for the in-app inbox in browsers) |
| `EMAIL_PROVIDERS` + provider settings | To send email: see [Email providers](email-providers.md). Leave empty to disable email |
| `BULL_BOARD_PASSWORD` | To use the queue dashboard. Without it, the dashboard is off in production |

Any other setting from the [configuration reference](configuration.md) can be
added to this file. Don't set `DATABASE_URL`, `MONGO_URI` or `REDIS_HOST`:
the compose file builds them from the passwords above.

`.env.production` contains secrets. It is git-ignored; keep it that way, and
make it readable only by you: `chmod 600 .env.production`.

## 4. Start

The command is long, so give it a short name first (add it to `~/.bashrc` to
keep it):

```bash
alias nh='docker compose -f docker/docker-compose.prod.yml --env-file .env.production'
```

Then:

```bash
nh up -d --build      # build the image and start everything (first time: a few minutes)
nh ps                 # all should be "Up", api "(healthy)"; migrate "Exited (0)" is correct
curl http://localhost:3000/health
# → {"status":"ok","services":{"postgres":"up","mongo":"up","redis":"up"}}
```

## 5. Create the admin account and an API key

The **first** account created becomes the admin; after that, signup closes
(unless `SIGNUP_ENABLED=true`).

```bash
curl -X POST http://localhost:3000/v1/auth/signup -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password","name":"Your Name","tenantName":"My Company"}'

curl -X POST http://localhost:3000/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password"}'
# → { "accessToken": "eyJ..." }

curl -X POST http://localhost:3000/v1/api-keys \
  -H "Authorization: Bearer eyJ..." -H "Content-Type: application/json" \
  -d '{"name":"production","environment":"live"}'
# → { "key": "nh_live_..." }   ← shown once, store it in your app's secrets
```

Do this right after the first start, before anyone else can reach the
server. Then follow [Sending notifications](sending-notifications.md).

## 6. HTTPS

Never expose the API over plain HTTP on the internet: API keys and tokens
would travel unencrypted. Two options:

### Option A: the built-in Caddy (automatic certificates)

1. Point your domain's DNS **A record** at the server (e.g. `notify.example.com`).
2. Open ports **80** and **443** in the server's firewall.
3. In `.env.production`:
   ```bash
   DOMAIN=notify.example.com
   API_BIND=127.0.0.1    # the API is then reachable only through Caddy
   ```
4. Start with the `https` profile:
   ```bash
   nh --profile https up -d
   ```

Caddy gets a Let's Encrypt certificate on its own, renews it, redirects
HTTP to HTTPS, and passes the inbox WebSocket through. Your API is now at
`https://notify.example.com`. Use `--profile https` in every later `nh up`
too.

### Option B: your own reverse proxy

Already running nginx, Traefik or a cloud load balancer? Keep `API_BIND=127.0.0.1`
(if the proxy is on the same machine) and point it at port `3000`. It must
pass **WebSocket upgrades** (for the inbox); see the nginx example in
[Scaling](scaling.md#5-step-3-run-more-api-instances).

## 7. Day-to-day operations

```bash
nh ps                           # status
nh logs -f api worker           # follow logs (Ctrl+C to stop)
nh logs --since 1h worker       # recent worker logs
nh restart api                  # restart one service
nh up -d --scale worker=3       # run 3 workers (see docs/scaling.md)
nh stop                         # stop everything (data is kept)
nh up -d                        # start again
```

Stopping is graceful: workers finish the notifications they are sending
(up to 60 s) before exiting, and queued jobs wait safely in Redis.

## 8. Updating

```bash
git pull
nh up -d --build
```

The image is rebuilt, `migrate` applies any new database migrations, and the
API and worker restart with the new version. Data volumes are kept. Read the
release notes first for anything that needs a settings change.

## 9. Backups

What to back up: **PostgreSQL** (accounts, API keys) and **MongoDB**
(notifications, inbox). Redis only holds the queue, and `.env.production`
holds your secrets (keep a copy somewhere safe).

```bash
# Back up
nh exec -T postgres pg_dump --clean --if-exists -U notifyhub notifyhub > backup-postgres-$(date +%F).sql
nh exec -T mongo sh -c 'mongodump -u notifyhub -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin --db notifyhub --archive' > backup-mongo-$(date +%F).archive

# Restore (into a running stack; replaces the current data)
nh exec -T postgres psql -U notifyhub -v ON_ERROR_STOP=1 notifyhub < backup-postgres-2026-11-12.sql
nh exec -T mongo sh -c 'mongorestore -u notifyhub -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin --archive --drop' < backup-mongo-2026-11-12.archive
```

`--clean --if-exists` makes the PostgreSQL backup drop and recreate its
tables on restore, and `--drop` does the same for MongoDB, so a restore
replaces what's there instead of failing on existing data.

Run the backup commands daily (e.g. from cron) and copy the files off the
server. Test a restore once, before you need it.

## 10. Security checklist

- [ ] All passwords and secrets in `.env.production` are long and random; the file is `chmod 600`
- [ ] HTTPS in front of the API ([section 6](#6-https)), with `API_BIND=127.0.0.1`
- [ ] Server firewall: only 22 (SSH), 80 and 443 open
- [ ] Admin account created right after the first start; `SIGNUP_ENABLED=false`
- [ ] `CORS_ORIGINS` lists only your app(s), not `*`
- [ ] `BULL_BOARD_PASSWORD` set if you use the dashboard; consider `SWAGGER_ENABLED=false`
- [ ] Backups scheduled and copied off the server

Already handled by the setup: the databases are not reachable from outside
Docker's network, Redis requires a password, containers run as a non-root
user, and logs are rotated.

## 11. Troubleshooting

**`nh up` says "Set POSTGRES_PASSWORD in .env.production"**: a required
password is missing, or you forgot `--env-file .env.production` (use the
`nh` alias).

**`migrate` exited with an error / the API never starts**: `nh logs migrate`.
Usually the database password doesn't match (next item).

<a id="changed-a-database-password-after-the-first-start"></a>
**Changed a database password after the first start**: PostgreSQL and MongoDB
were initialised with the old password and keep it. Change it back, or (only
if you have no data to keep) delete the data with `nh down -v` and start
again. Redis picks up a new password on restart.

**API is `unhealthy`**: `curl localhost:3000/health` shows which dependency
is down; `nh logs api` shows why.

**Emails stay `retrying`**: check the provider settings and
`nh logs worker`. See [Email providers → troubleshooting](email-providers.md#7-troubleshooting).

**Inbox doesn't connect from the browser**: check `CORS_ORIGINS` and that
your proxy passes WebSocket upgrades. See [In-app inbox → troubleshooting](in-app-inbox.md#7-troubleshooting).

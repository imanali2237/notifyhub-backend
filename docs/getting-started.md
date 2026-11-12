# Getting started

From zero to your first email in about 10 minutes, on your own computer.
Deploying to a server? See [Self-hosting in production](self-hosting.md).

## 1. Requirements

| Tool | Version | Why |
|---|---|---|
| [Node.js](https://nodejs.org/) | 20.19+, 22.12+ or 24+ | Runs the API and the worker |
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | any recent | Runs PostgreSQL, MongoDB, Redis and Mailpit |
| Git | any | To clone the repository |

## 2. Install

```bash
git clone https://github.com/<your-username>/notifyhub.git
cd notifyhub
npm install
```

`npm install` also generates the database client (Prisma).

## 3. Configure

```bash
cp .env.example .env
```

Then open `.env` and replace the two secrets with random values:

```bash
openssl rand -hex 32   # run twice: one value for OTP_SECRET, one for JWT_SECRET
```

Everything else already works with the bundled Docker services. Emails go to
**Mailpit**, a local test mailbox, so nothing reaches real inboxes yet. See
[Email providers](email-providers.md) to send real email.

Every setting is described in the [configuration reference](configuration.md).

## 4. Run

```bash
npm run dev
```

This one command:

1. starts PostgreSQL, MongoDB, Redis and Mailpit in Docker (and waits until they are healthy)
2. applies database migrations
3. builds the code
4. runs the **API**, the **worker** and a compiler in watch mode, in one terminal

You should see, among others:

```
[api]    [Providers] email: smtp
[api]    [Swagger] API docs: http://localhost:3000/docs
[api]    [BullBoard] Queue dashboard: http://localhost:3000/queues
[worker] [EmailProcessor] email worker ready (concurrency 5)
```

| What | URL |
|---|---|
| API | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| API docs (Swagger) | http://localhost:3000/docs |
| Queue dashboard | http://localhost:3000/queues |
| Mailpit (test inbox) | http://localhost:8025 |

**Ctrl+C** stops the API and worker. The Docker services keep running (so the
next start is fast); stop them with `npm run infra:down`.

## 5. Create your account

The first account is the **admin** of your installation. By default
(`SIGNUP_ENABLED=false`) nobody else can sign up after it.

```bash
curl -X POST http://localhost:3000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password","tenantName":"My Company"}'
```

If `EMAIL_VERIFICATION_REQUIRED=true`, a 6-digit code is emailed to you (open
Mailpit at http://localhost:8025) and you confirm it:

```bash
curl -X POST http://localhost:3000/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","otp":"123456"}'
```

Then log in to get a token:

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password"}'
# → { "accessToken": "eyJ...", "tokenType": "Bearer", ... }
```

## 6. Create an API key

Your apps use an **API key** (not your password) to send notifications.

```bash
curl -X POST http://localhost:3000/v1/api-keys \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My backend","environment":"test"}'
# → { "key": "nh_test_...", "warning": "Copy this key now. You will not be able to see it again.", ... }
```

> **Copy the key now.** NotifyHub stores only a hash of it and can never show
> it again. Lost it? Revoke it (`DELETE /v1/api-keys/:id`) and create a new one.

`test` keys start with `nh_test_`, `live` keys with `nh_live_`. The type is
recorded on every notification so you can tell test traffic from real traffic.

## 7. Send your first email

```bash
curl -X POST http://localhost:3000/v1/email/send \
  -H "x-api-key: nh_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "to": { "subscriberId": "user_123", "email": "sara@example.com", "name": "Sara" },
    "payload": { "orderId": "A42" },
    "subject": "Order {{orderId}} shipped",
    "html": "<p>Hi {{subscriber.name}}, your order <b>{{orderId}}</b> is on its way.</p>"
  }'
# → 202 { "status": "queued", "notifications": [{ "channel": "email", "notificationId": "..." }] }
```

Open **http://localhost:8025**: the email is there, with `{{orderId}}` and
`{{subscriber.name}}` filled in.

Check its delivery status:

```bash
curl http://localhost:3000/v1/notifications/<notificationId> -H "x-api-key: nh_test_..."
# → { "status": "sent", "provider": "smtp", "attempts": 1, ... }
```

Prefer clicking? Open **http://localhost:3000/docs**, press **Authorize**, paste
your API key under `api-key`, and try the endpoints from the browser.

## Next steps

- Send real email: [Email providers](email-providers.md)
- Call NotifyHub from your app: [Sending notifications](sending-notifications.md)
- Show a live notification inbox in your app: [In-app inbox](in-app-inbox.md)
- Tune retries, timeouts, security: [Configuration reference](configuration.md)

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start everything (Docker services + API + worker, auto-restart on code changes) |
| `npm run infra:up` / `infra:down` | Start / stop only the Docker services |
| `npm run infra:ps` / `infra:logs` | Status / logs of the Docker services |
| `npm run infra:reset` | Stop the Docker services **and delete all their data** |
| `npm run build` then `npm run start:prod` and `npm run start:worker` | Run the compiled API and worker (production style) |
| `npm run db:migrate` | Create and apply a new migration after changing `prisma/schema.prisma` |
| `npm run db:studio` | Browse the PostgreSQL data in a web UI |
| `npm test` / `npm run test:e2e` | Unit tests / end-to-end tests (e2e needs the Docker services running) |
| `npm run lint` / `npm run format` | Lint / format the code |

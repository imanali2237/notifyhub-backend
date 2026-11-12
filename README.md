# NotifyHub

> An open-source, **self-hosted** notification platform. Run it on your own
> server with one command; your apps send notifications with one API call, and
> NotifyHub handles providers, templates, queuing, retries, failover and
> delivery logs.

![Status](https://img.shields.io/badge/status-in%20development-orange)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

```bash
curl -X POST http://localhost:3000/v1/email/send \
  -H "x-api-key: nh_live_..." -H "Content-Type: application/json" \
  -d '{
    "to": { "subscriberId": "user_123", "email": "sara@example.com", "name": "Sara" },
    "payload": { "orderId": "A42" },
    "subject": "Order {{orderId}} shipped",
    "html": "<p>Hi {{subscriber.name}}, order <b>{{orderId}}</b> is on its way.</p>",
    "idempotencyKey": "order-A42-shipped"
  }'
```

---

## 📚 Documentation

| Guide | |
|---|---|
| [Getting started](docs/getting-started.md) | Install, run, create an account and API key, send your first email |
| [Self-hosting in production](docs/self-hosting.md) | Docker deployment: one command, HTTPS, updates, backups, security checklist |
| [Email providers](docs/email-providers.md) | Gmail, Brevo, any SMTP server — and **several providers with automatic failover** |
| [In-app inbox](docs/in-app-inbox.md) | A live notification inbox (bell icon) inside your own app |
| [Sending notifications](docs/sending-notifications.md) | Endpoints, templates, idempotency, tracking delivery, errors |
| [Configuration reference](docs/configuration.md) | Every `.env` setting with its default |
| [Queues and workers](docs/queues-and-workers.md) | Retries, the queue dashboard, concurrency |
| [Scaling](docs/scaling.md) | More workers and API instances, load balancing, capacity planning — **tested at 20,000 notifications/min** |
| [Adding a provider or channel](docs/contributing/adding-a-provider.md) | Contributor guide |
| [Architecture](docs/architecture.md) | Full design and roadmap |

---

## Features

**Works today**

- **Self-hosted, one command** — `npm run dev` for development; `docker compose ... up -d` for production, with optional automatic HTTPS ([guide](docs/self-hosting.md))
- **Email** through **SMTP** (Gmail, any server, Mailpit for local testing) and **Brevo**
- **Provider failover** — list providers in order (`EMAIL_PROVIDERS=brevo,smtp`); if one fails, the next takes over
- **In-app inbox** — messages appear **instantly** in your app over a WebSocket (Socket.IO + Redis), with an inbox API (list, unread count, mark read), secure per-user tokens and a [demo page](examples/inbox-demo/index.html)
- **Reliable delivery** — queue per channel, retries with exponential backoff, dead-letter queue, idempotency keys
- **Scales out** — run more workers or API instances with the same `.env`; load-tested at 20,000 notifications/min on a laptop ([details](docs/scaling.md#8-measured-performance))
- **Delivery tracking** — every notification's status and full history
- **Templates** — Handlebars with automatic HTML escaping
- **Accounts and API keys** — the first account is the admin; API keys are shown once and stored hashed
- **Everything configurable via `.env`**, validated at startup
- **Built-in tools** — Swagger API docs, queue dashboard (Bull Board), Mailpit test inbox
- **Plug-and-play design** — a new provider is one class + one line

**Planned** (see the [roadmap](docs/architecture.md#11-roadmap)): SMS, Telegram / Discord / Slack, push, `<Inbox />` React component, subscribers and preferences, workflows, outbound webhooks, dashboard, `@notifyhub/node` SDK.

---

## Quick start

Requirements: Node.js 20.19+ / 22.12+ / 24+, Docker.

```bash
git clone https://github.com/<your-username>/notifyhub.git
cd notifyhub
npm install
cp .env.example .env        # then set OTP_SECRET and JWT_SECRET (openssl rand -hex 32)
npm run dev
```

| What | URL |
|---|---|
| API | http://localhost:3000 |
| API docs (Swagger) | http://localhost:3000/docs |
| Queue dashboard | http://localhost:3000/queues |
| Mailpit (test inbox) | http://localhost:8025 |

Then follow [Getting started](docs/getting-started.md#5-create-your-account) to
create your account and API key and send your first email.

### Production (Docker)

Requirements: a Linux server with Docker. No Node.js needed.

```bash
git clone https://github.com/<your-username>/notifyhub.git && cd notifyhub
cp .env.production.example .env.production      # set passwords, secrets, email
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build
```

HTTPS, updates, backups and scaling: [Self-hosting guide](docs/self-hosting.md).

---

## Architecture

```
your app ──► API (NestJS) ──► Redis queue (BullMQ) ──► worker ──► providers (SMTP, Brevo, ...)
               │   │                                      │
               │   └─► PostgreSQL (accounts, API keys)    ├─► MongoDB in-app inbox
               └─────► MongoDB (notifications, history) ◄─┘      │ Redis pub/sub
                                                                 ▼
your users' browsers ◄──────── WebSocket /inbox (Socket.IO) ── API
```

1. Your app calls `POST /v1/email/send`, `/v1/in-app/send` or `/v1/events/trigger` with an `x-api-key`
2. The API validates the request, checks the idempotency key, saves the notification (`queued`), adds a job to the channel's queue and answers `202` in milliseconds
3. A worker takes the job, renders the templates and sends through the configured providers in order, failing over when one fails
4. The result (`sent` / `retrying` / `failed`, which provider, every attempt) is recorded and available at `GET /v1/notifications/:id`
5. In-app messages are saved to the user's inbox and pushed live through Redis to the API's WebSocket, reaching every open tab

The API and worker are **separate processes**: workers scale independently,
and requests are still accepted while workers are down.

---

## Tech stack

| Layer | Choice |
|---|---|
| API & worker | [NestJS](https://nestjs.com/) 12, TypeScript (ESM), Node.js |
| Accounts & API keys | PostgreSQL + [Prisma](https://www.prisma.io/) 7 |
| Notifications & history | MongoDB + Mongoose |
| Queues, codes, idempotency | Redis + [BullMQ](https://docs.bullmq.io/) |
| Email | nodemailer (SMTP), Brevo REST API |
| Real-time | Socket.IO with the Redis adapter |
| Templates | Handlebars |
| Validation | class-validator (requests), zod (configuration) |
| Auth | argon2id (passwords), JWT, SHA-256 hashed API keys |
| Docs & tools | Swagger (`@nestjs/swagger`), Bull Board, Mailpit |
| Testing & quality | Vitest, Supertest, oxlint, Prettier |

---

## Repository structure

```
├── Dockerfile                  # Production image (API + worker + migrations)
├── docker/docker-compose.yml   # Development: PostgreSQL, MongoDB, Redis, Mailpit
├── docker/docker-compose.prod.yml  # Production: full stack, optional HTTPS (Caddy)
├── docs/                       # Guides (start at docs/README.md)
├── examples/inbox-demo/        # One-file live inbox page
├── prisma/                     # PostgreSQL schema + migrations
├── src/
│   ├── main.ts / worker.ts     # The two entry points: API and worker
│   ├── auth/  api-keys/  otp/  # Accounts, login, email verification, API keys
│   ├── events/                 # Sending endpoints: /v1/events/trigger, /v1/email/send, /v1/in-app/send
│   ├── inbox/                  # In-app inbox: storage, subscriber tokens, inbox API, WebSocket
│   ├── notifications/          # Notification storage + GET /v1/notifications/:id
│   ├── channels/               # Channel definitions (email, in_app; SMS etc. later)
│   ├── providers/              # Provider contract, registry with failover, SMTP, Brevo, inbox
│   ├── queues/                 # BullMQ setup + queue dashboard
│   ├── worker/                 # Job processors
│   ├── templates/              # Handlebars rendering
│   ├── config/                 # .env schema and defaults
│   └── ...                     # health, mail, redis, database, common
└── test/                       # End-to-end tests
```

---

## Design decisions

- **BullMQ over Kafka** — retries, delays, backoff and a dead-letter queue come built in, and Redis is already needed for verification codes and idempotency.
- **PostgreSQL + MongoDB** — accounts and keys are relational and need consistency; notification logs are high-volume, append-heavy and expire after 30 days.
- **One queue per channel** — a slow channel never blocks another, and each gets its own concurrency.
- **Two-layer idempotency** — `SET NX` in Redis plus a unique index in MongoDB, so a repeated request never sends twice.
- **Separate API and worker processes** — scale workers independently; accept requests even when workers are down.
- **Provider failover with three failure kinds** — temporary (try next, retry later), provider (try next), message (stop) — so backups are used when they can help and never when they can't.
- **Self-hosted configuration** — provider credentials live in the operator's `.env`, never in the database or API responses.
- **Subscriber tokens for browsers** — the inbox UI never sees an API key; your backend exchanges it for a short-lived token scoped to one user, signed with its own derived key.

---

## Roadmap

- [x] **Foundation:** Docker Compose, accounts + API keys, Swagger
- [x] **Async and reliable:** worker, BullMQ queues, retries + backoff, dead-letter queue, Bull Board, idempotency, status history
- [ ] **Channels and providers:** ~~provider registry~~ ✅, ~~SMTP + Brevo with failover~~ ✅, Telegram, Discord, SMS (console, textbee)
- [ ] **In-app and real-time:** ~~Socket.IO gateway~~ ✅, ~~inbox API~~ ✅, `<Inbox />` component, Web Push + FCM
- [ ] **Smart features:** subscribers, workflows, delays, digests, preferences, quiet hours, rate limiting, outbound webhooks
- [ ] **Dashboard and SDK:** Next.js dashboard, template editor, logs explorer, `@notifyhub/node` on npm, demo app
- [ ] **Production polish:** ~~production Docker Compose + self-hosting guide~~ ✅, ~~load tests~~ ✅, OpenTelemetry, metrics, structured logging, CI

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat(providers): add SES email provider`
3. Make sure `npm run lint`, `npm test` and `npm run test:e2e` pass
4. **Update the docs** for anything that changes setup, configuration or the API (see [docs/README.md](docs/README.md#keeping-these-docs-up-to-date))
5. Open a pull request

Adding a provider or channel? Start with [the contributor guide](docs/contributing/adding-a-provider.md).

---

## License

[MIT](LICENSE)

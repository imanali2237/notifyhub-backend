# NotifyHub

> A self-hostable, plug-and-play **Notification-as-a-Service**. Any app integrates with one API call or SDK, and NotifyHub handles channels, templates, preferences, queuing, retries and delivery logs.

![Status](https://img.shields.io/badge/status-in%20development-orange)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

```ts
// Inside ANY client app
await notify.trigger('order-shipped', {
  to: { subscriberId: 'user_123', email: 'ali@example.com' },
  payload: { orderId: 'A42', eta: 'Tomorrow' },
  idempotencyKey: 'order-A42-shipped',
});
```

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database (Prisma)](#database-prisma)
- [Scripts](#scripts)
- [API overview](#api-overview)
- [Adding a provider](#adding-a-provider)
- [Design decisions](#design-decisions)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **One API, many channels** — email, SMS, push, in-app, chat (Telegram / Discord / Slack) and outbound webhooks
- **Workflows** — define which channels fire, in what order, with delays, digests and fallbacks
- **Subscriber preferences** — per category and channel opt-outs, plus quiet hours by timezone
- **Templates** — Handlebars / MJML per channel, versioned
- **Reliable delivery** — BullMQ queues per channel, exponential backoff, dead letter queue, idempotency keys
- **Plug-and-play providers** — add a new provider with one class and one line of registration
- **Multi-tenant** — hashed API keys, per-tenant rate limiting, AES-256-GCM encrypted provider credentials
- **Real-time in-app inbox** — Socket.IO gateway and an embeddable `<Inbox />` React component
- **Full audit trail** — every status change of every message is logged
- **$0 budget** — every dependency has a free option for development and demos

---

## Architecture

```mermaid
flowchart LR
    subgraph Clients["Client Applications"]
        A1[Any Backend<br/>via REST / SDK]
        A2[Frontend App<br/>with Inbox widget]
    end

    subgraph NH["NotifyHub"]
        API[API Service<br/>NestJS]
        WF[Workflow Engine]
        Q[(Redis<br/>BullMQ Queues)]
        subgraph Workers["Channel Workers"]
            W1[Email]
            W2[SMS]
            W3[Push]
            W4[Chat]
            W5[Webhook]
        end
        WS[WebSocket Gateway<br/>Socket.IO]
        PG[(PostgreSQL<br/>via Prisma)]
        MG[(MongoDB<br/>logs & in-app feed)]
        DASH[Dashboard<br/>Next.js]
    end

    A1 -->|API key| API
    A2 <-->|real-time| WS
    API --> WF --> Q
    Q --> W1 & W2 & W3 & W4 & W5
    W5 -->|status events| A1
    API --> PG
    WF --> PG
    Workers --> MG
    WF -->|in-app| WS
    DASH --> API
```

**Request lifecycle**

1. Client calls `POST /v1/events/trigger` with an `x-api-key` header
2. API validates the DTO, resolves the tenant and checks the idempotency key in Redis
3. A notification is recorded in MongoDB (`queued`) and a job is added to the `workflow` queue; the API returns `202 Accepted`
4. The workflow engine loads the workflow, applies subscriber preferences, renders templates and fans out to channel queues
5. Channel workers send through the tenant's configured provider, retrying with exponential backoff on retryable errors
6. After max attempts, jobs go to the dead letter queue and an optional fallback channel
7. Status changes are logged and pushed to the client app through signed webhooks

The `api` and `worker` apps run as **separate processes**, so workers can be scaled independently of the API.

Full design notes live in [`docs/architecture.md`](docs/architecture.md).

---

## Tech stack

| Layer | Choice |
|---|---|
| API & workers | [NestJS](https://nestjs.com/) (TypeScript) |
| Config database | PostgreSQL + [Prisma](https://www.prisma.io/) ORM |
| Logs & in-app feed | MongoDB + Mongoose |
| Queues & cache | Redis + [BullMQ](https://docs.bullmq.io/) |
| Real-time | Socket.IO (Redis adapter) |
| Templates | Handlebars, MJML |
| Dashboard | Next.js, Tailwind CSS, shadcn/ui |
| API docs | `@nestjs/swagger` |
| Monorepo | pnpm workspaces |
| Testing | Jest, Supertest, Testcontainers, k6 |
| Observability | Pino, OpenTelemetry, Prometheus, Grafana |
| CI/CD | GitHub Actions |

**Providers**

| Channel | Providers |
|---|---|
| Email | Mailpit (local), Gmail SMTP, Brevo |
| SMS | Console (dev), textbee.dev, Twilio (mock-tested adapter) |
| Push | Firebase Cloud Messaging, Web Push (VAPID) |
| Chat | Telegram Bot API, Discord webhooks, Slack webhooks |
| In-app | Built-in Socket.IO gateway |
| Webhook | Built-in HMAC-signed dispatcher |

---

## Repository structure

```
notifyhub/
├── apps/
│   ├── api/                  # NestJS REST API + WebSocket gateway
│   ├── worker/               # NestJS standalone app running BullMQ processors
│   └── dashboard/            # Next.js admin dashboard
├── packages/
│   ├── database/             # Prisma schema, migrations, seed, generated client
│   ├── core/                 # Shared domain types, DTOs, enums
│   ├── providers/            # Provider interfaces + adapters (email, sms, push, chat)
│   ├── templates/            # Handlebars / MJML rendering
│   ├── sdk-node/             # @notifyhub/node
│   └── inbox-react/          # @notifyhub/react <Inbox />
├── examples/
│   └── demo-shop/            # Tiny e-commerce app that uses the SDK
├── docker/
│   └── docker-compose.yml
├── docs/
│   └── architecture.md
├── load-tests/
│   └── trigger.k6.js
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

The Prisma schema lives in `packages/database` so both `api` and `worker` share one generated client and one set of migrations.

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [pnpm](https://pnpm.io/) 9 or later (`npm install -g pnpm`)
- [Docker](https://www.docker.com/) and Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/notifyhub.git
cd notifyhub
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults work with the Docker Compose setup out of the box.

### 3. Start infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

This starts:

| Service | Port | Notes |
|---|---|---|
| PostgreSQL | `5432` | Config data (Prisma) |
| MongoDB | `27017` | Notification logs, in-app feed |
| Redis | `6379` | BullMQ queues, idempotency, rate limits |
| Mailpit | `1025` (SMTP), `8025` (UI) | Catches every email at http://localhost:8025 |

### 4. Set up the database

```bash
pnpm db:generate     # generate the Prisma client
pnpm db:migrate      # apply migrations
pnpm db:seed         # optional: create a demo tenant + API key
```

### 5. Run the apps

```bash
pnpm dev             # api + worker + dashboard in parallel

# or individually
pnpm dev:api
pnpm dev:worker
pnpm dev:dashboard
```

| App | URL |
|---|---|
| API | http://localhost:3000 |
| Swagger docs | http://localhost:3000/docs |
| Dashboard | http://localhost:3002 |
| Mailpit UI | http://localhost:8025 |

### 6. Send your first notification

```bash
curl -X POST http://localhost:3000/v1/events/trigger \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-api-key>" \
  -d '{
    "name": "order-shipped",
    "to": { "subscriberId": "user_123", "email": "ali@example.com" },
    "payload": { "orderId": "A42", "eta": "Tomorrow" },
    "idempotencyKey": "order-A42-shipped"
  }'
```

Then open http://localhost:8025 to see the email.

---

## Environment variables

| Variable | Example | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `API_PORT` | `3000` | Port for the API service |
| `DATABASE_URL` | `postgresql://notifyhub:notifyhub@localhost:5432/notifyhub?schema=public` | PostgreSQL connection used by Prisma |
| `MONGO_URL` | `mongodb://localhost:27017/notifyhub` | MongoDB for logs and in-app feed |
| `REDIS_URL` | `redis://localhost:6379` | Redis for BullMQ, idempotency and rate limiting |
| `ENCRYPTION_MASTER_KEY` | `<32-byte hex>` | AES-256-GCM key for provider credentials |
| `API_KEY_PEPPER` | `<random string>` | Extra secret mixed into API key hashes |
| `SMTP_HOST` | `localhost` | Default SMTP host (Mailpit in dev) |
| `SMTP_PORT` | `1025` | Default SMTP port |
| `IDEMPOTENCY_TTL_SECONDS` | `86400` | How long idempotency keys are remembered |
| `WORKER_CONCURRENCY_EMAIL` | `10` | Email worker concurrency |
| `WORKER_CONCURRENCY_SMS` | `5` | SMS worker concurrency |

Generate a master key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Never commit `.env`. Only `.env.example` belongs in the repo.

---

## Database (Prisma)

PostgreSQL holds **configuration** (relational, low volume, needs consistency) and is managed with Prisma. MongoDB holds **high-volume logs** and the in-app feed and is accessed with Mongoose.

**Postgres models** (`packages/database/prisma/schema.prisma`)

| Model | Purpose |
|---|---|
| `Tenant` | An application using NotifyHub, with plan and rate limit |
| `ApiKey` | Hashed keys with prefix and `dev` / `prod` environment |
| `Subscriber` | End users of a tenant, with email, phone, push tokens, timezone |
| `Workflow` | A trigger key such as `order-shipped`, with category |
| `WorkflowStep` | Ordered steps: `channel`, `delay` or `digest` |
| `Template` | Versioned per-channel content (Handlebars / MJML) |
| `ProviderConfig` | Per-tenant provider choice, priority and encrypted credentials |
| `Preference` | Subscriber opt-in/out per category and channel |
| `WebhookEndpoint` | Client URLs to receive signed status events |

**Mongo collections**

| Collection | Purpose |
|---|---|
| `notifications` | One document per message per channel, with full status history (TTL index keeps storage small) |
| `inbox_messages` | In-app feed with read / seen timestamps |

**Common Prisma commands**

```bash
pnpm db:migrate              # create + apply a migration in dev (prisma migrate dev)
pnpm db:deploy               # apply migrations in production (prisma migrate deploy)
pnpm db:generate             # regenerate the client after schema changes
pnpm db:studio               # open Prisma Studio
pnpm db:reset                # drop, recreate and reseed the dev database
```

---

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm format` | Prettier across the monorepo |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests (uses Testcontainers) |
| `pnpm db:*` | Prisma commands (see above) |
| `pnpm load-test` | Run the k6 load test against a local API |

---

## API overview

All endpoints are versioned under `/v1` and authenticated with an `x-api-key` header. Full interactive docs are available at `/docs` (Swagger).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/events/trigger` | Trigger a workflow for a subscriber |
| `GET` | `/v1/notifications/:id` | Get status and event history of a notification |
| `POST` | `/v1/subscribers` | Create or upsert a subscriber |
| `GET` | `/v1/subscribers/:id` | Get a subscriber |
| `PATCH` | `/v1/subscribers/:id/preferences` | Update channel / category preferences |
| `GET` | `/v1/inbox` | List in-app messages for a subscriber |
| `POST` | `/v1/inbox/:id/read` | Mark a message as read |

Trigger response:

```json
// 202 Accepted
{ "status": "queued", "notificationId": "6650f1..." }

// 200 OK (same idempotency key seen within 24h)
{ "status": "duplicate", "notificationId": "6650f1..." }
```

---

## Adding a provider

Every provider implements a single interface:

```ts
export interface ChannelProvider<TMessage> {
  readonly id: string;          // 'gmail_smtp', 'textbee', 'fcm' ...
  readonly channel: Channel;    // 'email' | 'sms' | 'push' | 'chat'
  send(message: TMessage, credentials: Record<string, string>): Promise<SendResult>;
  validateCredentials?(credentials: Record<string, string>): Promise<boolean>;
}
```

Write the class, then register it:

```ts
ProvidersModule.forRoot({ extraProviders: [MyCustomSmsProvider] });
```

The core never changes. Providers return `retryable: false` for permanent failures (invalid email, bad phone number) so they are not retried.

---

## Design decisions

- **BullMQ over Kafka** — job semantics (retries, delays, backoff, DLQ) come built in, and Redis is already needed for idempotency and rate limiting. Kafka would add operational cost without benefit at this scale.
- **Postgres + Mongo split** — configuration is relational and needs consistency; delivery logs are append-heavy with flexible payloads and expire after 30 days.
- **Prisma for Postgres** — type-safe queries shared across `api` and `worker`, with versioned migrations checked into the repo.
- **One queue per channel** — a slow SMS provider never blocks email delivery, and each channel gets its own concurrency setting.
- **Two-layer idempotency** — `SETNX` in Redis with a 24h TTL, plus a unique index in Mongo as a second guard if a worker crashes mid-job.
- **Separate API and worker processes** — workers scale independently, and graceful shutdown lets in-flight jobs finish on `SIGTERM`.
- **Encrypted credentials** — provider secrets are stored with AES-256-GCM and are never returned by the API.

---

## Roadmap

- [ ] **Phase 1 — Foundation:** monorepo, Docker Compose, Prisma schema, tenants + API keys, subscriber CRUD, synchronous email trigger, Swagger
- [ ] **Phase 2 — Async and reliable:** worker app, BullMQ queues, retries + backoff, DLQ, Bull Board, idempotency, Mongo logs, Testcontainers
- [ ] **Phase 3 — Channels and providers:** provider registry, Gmail / Brevo / textbee / Telegram / Discord, encrypted credentials, failover
- [ ] **Phase 4 — In-app and real-time:** Socket.IO gateway, inbox API, `<Inbox />` component, Web Push + FCM
- [ ] **Phase 5 — Smart features:** delays, digests, preferences, quiet hours, rate limiting, outbound webhooks
- [ ] **Phase 6 — Dashboard and SDK:** Next.js dashboard, template editor, logs explorer, `@notifyhub/node` on npm, demo shop
- [ ] **Phase 7 — Production polish:** OpenTelemetry, Prometheus + Grafana, Pino logging, k6 results, CI, live demo

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat(api): add subscriber endpoint`
3. Make sure `pnpm lint` and `pnpm test` pass
4. Open a pull request

---

## License

[MIT](LICENSE)
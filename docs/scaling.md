# Scaling NotifyHub

How to run NotifyHub for more traffic: what to watch, which part to scale,
and how to run several API and worker processes safely.

- [The short version](#the-short-version)
- [How NotifyHub is built to scale](#1-how-notifyhub-is-built-to-scale)
- [Know when to scale](#2-know-when-to-scale)
- [Step 1: tune one worker](#3-step-1-tune-one-worker)
- [Step 2: run more workers](#4-step-2-run-more-workers)
- [Step 3: run more API instances](#5-step-3-run-more-api-instances)
- [Step 4: the databases](#6-step-4-the-databases)
- [Capacity planning](#7-capacity-planning)
- [Measured performance](#8-measured-performance)
- [Production checklist](#9-production-checklist)

## The short version

| You see | Do this |
|---|---|
| Jobs piling up in the queue dashboard (`/queues`) | Run **more workers** |
| One channel slow, others fine | Raise **that channel's** `*_WORKER_CONCURRENCY`, or add workers |
| Email slow, CPU idle | Check `SMTP_POOL=true`; check your provider's rate limits |
| API slow to answer, requests time out | Run **more API instances** behind a load balancer |
| Provider errors like "too many connections" / "rate limit" | **Lower** concurrency or `SMTP_MAX_CONNECTIONS`, don't raise them |

Measured on one laptop: **one worker** sends **10,000 notifications per
minute** on one channel; **two workers** handle email + in-app together
(20,000 per minute). One API instance accepts about **14,000 requests per
minute**. Details in [measured performance](#8-measured-performance).

## 1. How NotifyHub is built to scale

```
                ┌──────────── load balancer (sticky) ────────────┐
your apps ──►   API #1      API #2      API #3        ◄── browsers (inbox WebSocket)
                   │  add jobs   │            │
                   ▼             ▼            ▼
             ┌─────────────── Redis ─────────────────┐   queues, idempotency,
             │ notifications.email  notifications.in_app │   live inbox pub/sub
             └──────────────────────────────────────┘
                   ▲             ▲            ▲
                worker #1    worker #2    worker #3   ──► SMTP / Brevo / inbox
                   │             │            │
                   └──── MongoDB (notifications, inbox) ── PostgreSQL (accounts, keys)
```

- **The API and the workers are separate processes.** The API only validates,
  saves and queues (milliseconds); workers do the slow part (sending). You
  scale them separately.
- **Every process is stateless.** Everything shared lives in Redis, MongoDB
  and PostgreSQL. So you can start a 2nd, 3rd... copy of either process with
  the **same `.env`**, on the same machine or another one.
- **Workers share jobs automatically.** BullMQ gives each job to exactly one
  worker (it is locked while being processed). No configuration, no
  coordination, nothing sent twice by two workers.
- **One queue per channel.** A slow email provider never delays in-app
  messages. In the tests, email had a 4,200-job backlog while in-app messages
  still arrived in ~50 ms.
- **A backlog is not data loss.** Jobs wait in Redis until a worker is free.
  If you send faster than workers can deliver, notifications arrive later,
  not never.

## 2. Know when to scale

Watch these three things:

1. **The queue dashboard** (`http://your-server:3000/queues`): the **Waiting**
   count of each queue. Near zero = workers keep up. Growing = workers are
   too slow for the incoming rate.
2. **Delivery delay**: in `GET /v1/notifications/:id`, compare `createdAt`
   with the time of the `sent` entry in `events`. Seconds or minutes = a
   backlog.
3. **API response time** and errors seen by your apps. `POST
   /v1/events/trigger` normally answers in 5–20 ms. If it's slow or times
   out, the **API** is the bottleneck, not the workers.

## 3. Step 1: tune one worker

Before adding processes, check the settings of the one you have
([configuration](configuration.md)):

| Setting | Default | Raise it when... | Careful |
|---|---|---|---|
| `EMAIL_WORKER_CONCURRENCY` | `5` | Email queue grows and the worker's CPU is low (it's waiting on the network) | Each slot is one email in flight at the provider |
| `IN_APP_WORKER_CONCURRENCY` | `10` | In-app queue grows | Each slot is a MongoDB write |
| `SMTP_POOL` | `true` | Always keep it on | `false` opens a new connection for every email: ~15× slower in our tests |
| `SMTP_MAX_CONNECTIONS` | `5` | You raised `EMAIL_WORKER_CONCURRENCY` above 5 | Many providers limit simultaneous connections per account |

Concurrency costs little memory, because sending is mostly waiting. But a
single Node.js process uses **one CPU core**: once a worker's CPU is near
100 %, raising concurrency stops helping. Add workers instead.

**Rate limits are the real ceiling for email.** Gmail, Brevo and others cap
how many emails you can send per second/day and how many connections you can
open. NotifyHub does not yet enforce a per-provider rate limit itself, so
keep **workers × `EMAIL_WORKER_CONCURRENCY`** (emails in flight) and
**workers × `SMTP_MAX_CONNECTIONS`** (open connections) within your
provider's limits. If you see rate-limit errors, these failures are
retried automatically, but lower the numbers rather than raising them.

## 4. Step 2: run more workers

A worker is just `node dist/worker.js` with the right `.env`. Run it as many
times as you need.

### Try it on one machine

```bash
npm run build
# terminal 1          # terminal 2          # terminal 3
npm run start:worker   npm run start:worker   npm run start:worker
```

Open the queue dashboard and send traffic: the jobs are spread across the
workers. Stop one with Ctrl+C: it finishes the jobs it's working on, then
exits; the others take over the rest.

### On a server: systemd

Run each copy as a service, so it starts on boot and restarts if it crashes.
Create `/etc/systemd/system/notifyhub-worker@.service`:

```ini
[Unit]
Description=NotifyHub worker %i
After=network-online.target

[Service]
WorkingDirectory=/opt/notifyhub
ExecStart=/usr/bin/node dist/worker.js
Restart=always
RestartSec=3
User=notifyhub
Environment=NODE_ENV=production
# SIGTERM → the worker stops taking jobs and finishes the current ones
KillSignal=SIGTERM
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now notifyhub-worker@1 notifyhub-worker@2 notifyhub-worker@3
sudo systemctl status 'notifyhub-worker@*'
journalctl -u 'notifyhub-worker@*' -f      # logs of all workers
```

`.env` is read from `WorkingDirectory`, so all copies use the same settings.

### On several machines

Copy the same build and `.env` to each machine; they only need network
access to Redis, MongoDB (and PostgreSQL for the API). Put `REDIS_HOST`,
`MONGO_URI` etc. to the shared servers' addresses instead of `localhost`.

### How many?

Start with one per channel-heavy workload and add one at a time while
watching the queue dashboard. On a single machine, more workers than CPU
cores (minus what the databases need) won't help.

## 5. Step 3: run more API instances

One API process accepted ~236 requests/s in our burst test. Above ~200
requests/s, run several API instances behind a **load balancer**.

### Sticky sessions are required (for the inbox WebSocket)

Socket.IO starts every connection with a few HTTP requests before upgrading
to a WebSocket, and **all of them must reach the same API instance**.
Configure your load balancer with **sticky sessions** (same client → same
instance). Without them, inbox connections fail with `400` errors.

(Alternative: make the browser skip the HTTP step with
`io(url, { auth: { token }, transports: ['websocket'] })`. Then stickiness
isn't needed, but clients that can't open WebSockets can't connect.)

Messages still reach every user whichever instance they're connected to:
each instance listens on Redis (the Socket.IO **Redis adapter**), so a
message published by any worker is delivered by the instance that holds
the user's socket.

### Example: two instances on one machine with nginx

```bash
PORT=3000 node dist/main.js
PORT=3001 node dist/main.js
```

```nginx
upstream notifyhub_api {
  ip_hash;                       # sticky: same client IP → same instance
  server 127.0.0.1:3000;
  server 127.0.0.1:3001;
}

server {
  listen 80;
  server_name notify.example.com;

  location / {
    proxy_pass http://notifyhub_api;
    proxy_http_version 1.1;
    # WebSocket upgrade (inbox)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 1h;       # keep idle inbox sockets open
  }
}
```

Use **`GET /health`** as the load balancer's health check: it answers `200`
only when PostgreSQL, MongoDB and Redis are all reachable.

Each API instance also serves Swagger (`/docs`) and the queue dashboard
(`/queues`); they show the same shared data whichever instance you reach.

## 6. Step 4: the databases

All API and worker processes share these, so they are what's left to scale
once you run many processes.

**Redis** (queues, idempotency, live inbox):

- `maxmemory-policy` **must be `noeviction`**. Any other policy lets Redis
  delete queued jobs when memory is full. BullMQ logs a warning at startup if
  it isn't. The provided `docker/docker-compose.yml` uses Redis's default
  (`noeviction`).
- Turn on persistence (`appendonly yes`, as in the provided compose file) so
  queued jobs survive a Redis restart.
- Memory: finished jobs are removed after `QUEUE_KEEP_COMPLETED_SECONDS` /
  `QUEUE_KEEP_COMPLETED_COUNT`, so Redis stays small unless a large backlog
  builds up. Each waiting job is small (it holds only the notification id).
- Connections: each worker opens ~3, each API instance a few more (plus 2 for
  the inbox WebSocket adapter).

**MongoDB** (notifications, inbox):

- Every send writes the notification several times (queued → processing →
  sent). The indexes NotifyHub needs are created automatically.
- Old data is deleted automatically: notifications after 30 days, inbox
  messages after 90 days, so storage stays bounded.

**PostgreSQL** (accounts, API keys): read once per API request to check the
key. Light load; the default setup is enough for a long time.

## 7. Capacity planning

Rough guide from the [measurements below](#8-measured-performance) (local
SMTP server; real providers are slower per email and have rate limits):

| Your peak load | Workers | API instances |
|---|---|---|
| Up to ~10,000 notifications/min, one channel | 1 | 1 |
| ~20,000/min across email + in-app | 2 | 1 |
| More, or real providers with slow responses | Add workers until the queue stays near zero | 1 per ~200 requests/s |

Size for your **peak** (e.g. a sale or a daily digest), not your average, or
accept that peaks are delivered a little later (the queue absorbs them).

## 8. Measured performance

Load tests on one laptop (8 cores, 14 GB RAM), with everything on the same
machine: API, workers, PostgreSQL, MongoDB, Redis, Mailpit as the SMTP
server, and the load generator. Each "request" is one
`POST /v1/events/trigger`. Default settings unless noted.

| Test | Load | Result |
|---|---|---|
| In-app only, 1 worker | 10,000 requests in 1 min (167/s) | All sent. Queue never above 2 jobs. Queued → sent p50 10 ms; reached the browser over the WebSocket p50 16 ms |
| Email only, 1 worker, **no pooling** | 10,000 in 1 min | Worker did only ~11 emails/s; the queue grew by ~150 jobs every second. Opening thousands of new SMTP connections also overwhelmed Docker Desktop's port forwarding |
| Email only, 1 worker, **pooling** | 10,000 in 1 min | All sent, keeping up in real time. Queued → sent p50 14 ms, p99 213 ms |
| Email + in-app, 1 worker | 10,000 requests = 20,000 notifications in 1 min | All sent. In-app stayed instant (p50 44 ms, its own queue); email peaked at ~130/s, so a backlog of ~4,200 built up and cleared 17 s after the load stopped |
| Email + in-app, **2 workers** | 20,000 notifications in 1 min | All sent, keeping up in real time. Email p50 91 ms, in-app p50 49 ms. The two workers shared the jobs automatically |
| Burst, 2 workers | 400 requests/s | One API process topped out at ~236 requests/s; the rest waited and many timed out on the client. Every accepted request was sent. Workers handled ~170 emails/s + ~170 in-app/s |

In every test, no accepted notification was lost or failed. Memory: ~250–450
MB per API instance and ~200–400 MB per worker under this load.

## 9. Production checklist

- [ ] `npm run build`, then run `node dist/main.js` (API) and `node dist/worker.js` (workers) under a process manager (systemd, Docker, ...) that restarts them
- [ ] `NODE_ENV=production`, real secrets (`openssl rand -hex 32`), `BULL_BOARD_PASSWORD` set
- [ ] `SMTP_POOL=true`; worker and connection counts within your email provider's limits
- [ ] Redis: `maxmemory-policy noeviction`, persistence on
- [ ] More than one API instance → load balancer with **sticky sessions** and WebSocket upgrade, health check on `/health`
- [ ] `CORS_ORIGINS` set to your app's address instead of `*`
- [ ] Stop processes with SIGTERM (not SIGKILL), so in-flight jobs finish
- [ ] Watch the queue dashboard after launch; add workers if Waiting keeps growing

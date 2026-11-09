# Queues and workers

NotifyHub runs as **two processes**:

| Process | Command (production) | Job |
|---|---|---|
| **API** | `npm run start:prod` (`node dist/main`) | Receives requests, validates, saves, puts jobs on the queue, answers in milliseconds |
| **Worker** | `npm run start:worker` (`node dist/worker`) | Takes jobs from the queue, renders templates, sends through the providers, records the result |

They never talk to each other directly: they share a **queue in Redis**
(BullMQ). If the worker is stopped, requests are still accepted and wait in
the queue; when it starts again, it catches up.

```
your app ──► API ──► Redis queue "notifications.email" ──► worker ──► providers (SMTP, Brevo...)
              │                                              │
              └────────────► MongoDB (status, history) ◄─────┘
```

Each channel has its own queue (`notifications.email` today), so a slow
channel never delays another.

## Retries

When every provider fails **temporarily** (timeout, server down, rate limit),
the job is retried later with exponential backoff:

| Try | Waits before it (defaults) |
|---|---|
| 1 | — |
| 2 | 2 s |
| 3 | 4 s |
| 4 | 8 s |
| 5 | 16 s |

Each try runs through **all** configured providers in order (see
[failover](email-providers.md#5-several-providers-failover)). After the last
try — or straight away for a permanent error — the notification becomes
`failed` and the job moves to the **failed list** (dead-letter queue), kept
7 days.

Tune with `QUEUE_MAX_ATTEMPTS` and `QUEUE_BACKOFF_DELAY_MS`
([configuration](configuration.md#queues-and-retries)).

## Queue dashboard

`http://<host>:<PORT>/queues` (Bull Board) shows every queue live:

| Tab | Meaning |
|---|---|
| Waiting | Queued, no worker has taken it yet |
| Active | Being sent right now |
| Delayed | Waiting for its next retry |
| Completed | Sent (kept 1 day) |
| Failed | Gave up (kept 7 days) — open a job to see the error, or press **Retry** |

Security: with `BULL_BOARD_PASSWORD` set, the browser asks for a login
(`BULL_BOARD_USERNAME`, default `admin`). Without a password it is only served
when `NODE_ENV=development`. `BULL_BOARD_READ_ONLY=true` hides the action
buttons. See [configuration](configuration.md#queue-dashboard-bull-board).

## Concurrency and scaling

- `EMAIL_WORKER_CONCURRENCY` (default `5`) = emails **one worker process**
  sends at the same time. Sending is mostly waiting on the network, so this is
  cheap to raise.
- Run **more worker processes** (same command, same `.env`, any machine that
  reaches Redis and MongoDB) for more throughput or to survive a crashed
  worker. Each job is locked by one worker, so nothing is sent twice by two
  workers.
- Total in-flight emails = worker processes × concurrency.
- The real limit is usually your **provider's** rate limit. If you see
  rate-limit errors, lower concurrency rather than raising it.

Rough cost of one worker: ~150–200 MB RAM, a small fraction of a CPU core,
3 Redis connections and a few MongoDB connections.

## Delivery guarantee

Delivery is **at least once**: if a worker crashes after the provider accepted
an email but before NotifyHub recorded it, the job is retried and the
recipient may get it twice. This is rare, and the same trade-off every queue
based notification system makes. (A notification already marked `sent` is
never sent again.)

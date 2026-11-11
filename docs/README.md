# NotifyHub documentation

NotifyHub is an open-source, self-hosted notification platform. You run it on
your own server; your apps send notifications through its API.

> **Status:** in development. These docs describe what is **built today**.
> Planned features are listed in the [roadmap](architecture.md#11-roadmap)
> and are added here only once they work.

## Guides

| Guide | Read it when you want to... |
|---|---|
| [Getting started](getting-started.md) | Install NotifyHub, run it, create an account and an API key, send your first email |
| [Email providers](email-providers.md) | Connect Gmail, Brevo or any SMTP server; use **several providers with automatic failover** |
| [In-app inbox](in-app-inbox.md) | Show a live notification inbox (bell icon) inside your own app |
| [Sending notifications](sending-notifications.md) | Call the API from your app: endpoints, templates, idempotency, tracking delivery, errors |
| [Configuration reference](configuration.md) | Look up **every** `.env` setting, its default and what it does |
| [Queues and workers](queues-and-workers.md) | Understand retries, the queue dashboard, concurrency and scaling |
| [Scaling](scaling.md) | Handle more traffic: tuning, more workers, more API instances, load balancer, capacity planning, measured performance |
| [Adding a provider or channel](contributing/adding-a-provider.md) | Contribute a new provider (e.g. SES) or channel (e.g. SMS) |
| [Architecture](architecture.md) | The full design and roadmap |

## What works today

| Area | Status |
|---|---|
| Accounts | Signup, login (JWT), optional email verification (OTP), signup can be closed |
| API keys | Create / list / revoke; shown once, stored hashed; `test` and `live` keys |
| Email | ✅ `POST /v1/events/trigger` and `POST /v1/email/send` |
| Email providers | ✅ SMTP (Gmail, Mailpit, any server), Brevo — with failover |
| In-app inbox | ✅ `POST /v1/in-app/send`, subscriber tokens, inbox API, live WebSocket (`/inbox`), demo page |
| Reliability | Queue per channel, retries with exponential backoff, dead-letter queue, idempotency keys |
| Tracking | `GET /v1/notifications/:id` with full status history |
| Tools | Swagger docs (`/docs`), queue dashboard (`/queues`), Mailpit (`:8025`) |
| SMS, Telegram, push, `<Inbox />` React component, SDK, dashboard | Planned |

## Keeping these docs up to date

These docs grow with the code. **Every feature that changes how NotifyHub is
installed, configured or called must update the matching page in the same
pull request:**

- new or changed `.env` setting → [configuration.md](configuration.md) (and `.env.example`)
- new provider → [email-providers.md](email-providers.md) (or the channel's page)
- new or changed endpoint → [sending-notifications.md](sending-notifications.md)
- new channel → a new `docs/<channel>.md` page, linked from this index
- anything moving from "planned" to "works" → the table above

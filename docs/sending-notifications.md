# Sending notifications

How your application talks to NotifyHub. Interactive docs with every field are
also served by your installation at **`/docs`** (Swagger).

- [Authentication](#authentication)
- [Send an email](#send-an-email--post-v1emailsend)
- [Send on several channels](#send-on-several-channels--post-v1eventstrigger)
- [The recipient (`to`)](#the-recipient-to)
- [Templates](#templates)
- [Idempotency: safe retries](#idempotency-safe-retries)
- [Responses](#responses)
- [Tracking delivery](#tracking-delivery--get-v1notificationsid)
- [Errors](#errors)
- [All endpoints](#all-endpoints)

---

## Authentication

Every sending endpoint needs an **API key** in the `x-api-key` header:

```http
x-api-key: nh_live_PQPKEqWDylmPxfyIpkIyodr8IFRt74w1
```

Create keys with your account (see [Getting started](getting-started.md#6-create-an-api-key)).
Keep them on your **server** — never in a browser or mobile app, where anyone
could read them. A key only sees its own tenant's notifications.

Check which tenant a key belongs to:

```bash
curl http://localhost:3000/v1/api-keys/current -H "x-api-key: nh_live_..."
# → { "tenantId": "...", "tenantName": "My Company", "apiKeyId": "...", "environment": "live" }
```

---

## Send an email — `POST /v1/email/send`

The simplest way when you only need email.

```json
{
  "event": "order-shipped",
  "to": { "subscriberId": "user_123", "email": "sara@example.com", "name": "Sara" },
  "payload": { "orderId": "A42", "eta": "Tomorrow" },
  "subject": "Order {{orderId}} shipped",
  "html": "<h2>Hi {{subscriber.name}}</h2><p>Order <b>{{orderId}}</b> arrives {{eta}}.</p>",
  "text": "Hi {{subscriber.name}}, order {{orderId}} arrives {{eta}}.",
  "idempotencyKey": "order-A42-shipped"
}
```

| Field | Required | Rules |
|---|---|---|
| `to` | yes | See [the recipient](#the-recipient-to). `to.email` is required here |
| `subject` | yes | 1–998 characters, may use `{{placeholders}}` |
| `html` | one of `html` / `text` | Up to 500,000 characters. Inserted values are HTML-escaped |
| `text` | one of `html` / `text` | Up to 100,000 characters. Plain-text version for clients that don't show HTML |
| `payload` | no | Object with the values for your `{{placeholders}}` |
| `event` | no | What happened in your app (shown in logs and on the notification). Lowercase letters/digits separated by `-` `_` `.`, max 100. Default `email.send` |
| `idempotencyKey` | no | 1–255 characters. See [idempotency](#idempotency-safe-retries) |

Minimal example:

```bash
curl -X POST http://localhost:3000/v1/email/send \
  -H "x-api-key: nh_live_..." -H "Content-Type: application/json" \
  -d '{"to":{"subscriberId":"u1","email":"sara@example.com"},"subject":"Welcome!","text":"Thanks for signing up."}'
```

---

## Send on several channels — `POST /v1/events/trigger`

One request, one notification **per channel**. Today the only channel is
`email`; SMS, Telegram and others will be added under `channels` the same way.

```json
{
  "event": "order-shipped",
  "to": { "subscriberId": "user_123", "email": "sara@example.com", "name": "Sara" },
  "payload": { "orderId": "A42" },
  "channels": {
    "email": {
      "subject": "Order {{orderId}} shipped",
      "html": "<p>Hi {{subscriber.name}}, order <b>{{orderId}}</b> shipped.</p>"
    }
  },
  "idempotencyKey": "order-A42-shipped"
}
```

| Field | Required | Rules |
|---|---|---|
| `event` | **yes** | Same format as above |
| `to` | yes | Must contain the address each requested channel needs |
| `channels` | yes | At least one channel. `channels.email` takes `subject`, `html`, `text` (same rules as `/v1/email/send`) |
| `payload`, `idempotencyKey` | no | Same as above |

Both endpoints go through the exact same pipeline (validation, idempotency,
queue, worker, providers) — pick whichever shape you prefer.

---

## The recipient (`to`)

| Field | Required | Rules |
|---|---|---|
| `subscriberId` | yes | **Your** app's id for this person (1–200 characters) |
| `email` | for email | Valid email; trimmed and lowercased |
| `phone` | for phone channels (future) | E.164 format, e.g. `+923001234567` |
| `name` | no | Max 200 characters; available as `{{subscriber.name}}` |

---

## Templates

`subject`, `html` and `text` are [Handlebars](https://handlebarsjs.com/guide/)
templates.

| Placeholder | Comes from |
|---|---|
| `{{orderId}}`, `{{eta}}`, `{{anything}}` | `payload` |
| `{{customer.address.city}}` | nested objects in `payload` |
| `{{subscriber.name}}`, `{{subscriber.email}}`, `{{subscriber.subscriberId}}` | `to` |

```handlebars
{{#if coupon}}Use code {{coupon}} for 10% off.{{/if}}
{{#each items}}<li>{{this.name}} × {{this.qty}}</li>{{/each}}
```

- **In `html`, inserted values are HTML-escaped**: a payload value
  `<script>alert(1)</script>` is shown as text, never run. Use `{{{triple}}}`
  only for HTML you trust completely.
- `subject` and `text` are not escaped (they aren't HTML).
- A missing value renders as an empty string.
- A **syntax error** (e.g. `Hi {{name`) is rejected immediately with `400`.
- Don't name a payload key `subscriber` — it's reserved for the recipient.

---

## Idempotency: safe retries

Networks fail. If your request times out you don't know whether NotifyHub got
it — retrying could send the email twice. An **idempotency key** prevents that:

- Send a key that identifies the *event*, e.g. `order-A42-shipped`.
- If the same key arrives again within **24 hours**
  (`IDEMPOTENCY_TTL_SECONDS`), nothing is sent again; you get `200` with
  `"status": "duplicate"` and the **original** notification ids.
- Keys are per tenant and shared by both sending endpoints.
- If NotifyHub answers `503`, nothing was saved — retrying with the same key is safe.

---

## Responses

**`202 Accepted`** — saved and queued; it will be sent in the background:

```json
{
  "status": "queued",
  "transactionId": "fe568927-5d47-4346-99c6-d05e81badd55",
  "notifications": [
    { "channel": "email", "notificationId": "6af1908f023f5798b0e7849f" }
  ]
}
```

**`200 OK`** — duplicate idempotency key, nothing re-sent:

```json
{ "status": "duplicate", "transactionId": "fe568927-...", "notifications": [ ... ] }
```

`202` means *accepted*, not *delivered*. Delivery happens a moment later in
the worker; [track it](#tracking-delivery--get-v1notificationsid) with the
`notificationId`. `transactionId` groups the notifications of one request.

---

## Tracking delivery — `GET /v1/notifications/:id`

```bash
curl http://localhost:3000/v1/notifications/6af1908f023f5798b0e7849f -H "x-api-key: nh_live_..."
```

```json
{
  "id": "6af1908f023f5798b0e7849f",
  "transactionId": "fe568927-...",
  "environment": "live",
  "event": "order-shipped",
  "channel": "email",
  "recipient": { "subscriberId": "user_123", "email": "sara@example.com", "name": "Sara" },
  "payload": { "orderId": "A42" },
  "content": { "subject": "Order {{orderId}} shipped", "html": "..." },
  "rendered": { "subject": "Order A42 shipped", "html": "..." },
  "status": "sent",
  "attempts": 1,
  "provider": "smtp",
  "providerMessageId": "<b8933...@notifyhub.local>",
  "events": [
    { "status": "queued", "at": "..." },
    { "status": "processing", "at": "..." },
    { "status": "sent", "at": "...", "meta": { "provider": "smtp", "providerMessageId": "<b8933...@notifyhub.local>" } }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

| `status` | Meaning |
|---|---|
| `queued` | Accepted, waiting for the worker |
| `processing` | The worker is sending it now |
| `retrying` | All providers failed temporarily; it will be tried again (see `lastError`) |
| `sent` | A provider accepted it — `provider` says which one |
| `failed` | Gave up: permanent error, or out of attempts. `lastError` says why |

```
queued → processing → sent
                   ↘ retrying → processing → ... → failed
```

Notifications are kept for **30 days**, then deleted automatically.

---

## Errors

Errors have this shape:

```json
{ "statusCode": 400, "error": "Bad Request", "message": "to.email is required for the email channel" }
```

(`message` can also be a list, one entry per invalid field.)

| Code | When | What to do |
|---|---|---|
| `400` | Invalid body; unknown field; missing `to.email`; no `html`/`text`; template syntax error; **email channel not enabled** on this server | Fix the request (or the server's [providers](email-providers.md)). Don't retry unchanged |
| `401` | Missing, invalid or revoked API key | Check the `x-api-key` header |
| `404` | Notification not found, or it belongs to another tenant | Check the id and the key |
| `503` | Redis / queue temporarily unavailable — nothing was saved | Retry with backoff, using the same `idempotencyKey` |

---

## All endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/v1/auth/signup` | — | Create an account + tenant (first account always; others only if `SIGNUP_ENABLED=true`) |
| `POST` | `/v1/auth/verify-email` | — | Confirm the emailed 6-digit code (`{ email, otp }`) |
| `POST` | `/v1/auth/resend-otp` | — | Send a new code |
| `POST` | `/v1/auth/login` | — | Get a JWT (`accessToken`) |
| `GET` | `/v1/auth/me` | JWT | Your account |
| `POST` | `/v1/api-keys` | JWT | Create an API key (`{ name, environment: "test" \| "live" }`) — the key is shown **once** |
| `GET` | `/v1/api-keys` | JWT | List your keys (without the secret) |
| `DELETE` | `/v1/api-keys/:id` | JWT | Revoke a key |
| `GET` | `/v1/api-keys/current` | API key | Which tenant this key belongs to |
| `POST` | `/v1/email/send` | API key | Send an email |
| `POST` | `/v1/events/trigger` | API key | Send on one or more channels |
| `GET` | `/v1/notifications/:id` | API key | Status and history of a notification |
| `GET` | `/health` | — | `{ status, services: { postgres, mongo, redis } }` |

JWT = `Authorization: Bearer <accessToken>` from login.

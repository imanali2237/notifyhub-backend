# In-app inbox

The in-app inbox is the bell icon with a list of notifications **inside your
own app**, like the one on GitHub or LinkedIn. NotifyHub stores the messages
and pushes new ones to the browser **instantly** over a WebSocket.

It is built in: no outside service, no account, no cost. It is **on by
default** (`IN_APP_ENABLED=true`).

```
your backend ──POST /v1/in-app/send──► NotifyHub ──► queue ──► worker
                                                                │ saves to MongoDB
                                                                │ publishes to Redis
                                                                ▼
your user's browser ◄──── WebSocket /inbox ──── NotifyHub API (Socket.IO)
       │
       └──GET /v1/inbox/messages, POST .../read──► NotifyHub API
```

## 1. Who calls what

There are **two** callers, and they authenticate differently:

| Caller | Auth | Calls |
|---|---|---|
| **Your backend** | API key (`x-api-key`) | `POST /v1/in-app/send` (or `/v1/events/trigger`): send a message. `POST /v1/inbox/tokens`: get a token for one user |
| **Your user's browser** | Subscriber token (`Authorization: Bearer ...`) | `GET /v1/inbox/messages`, mark read, and the `/inbox` WebSocket |

**Never put your API key in browser code.** Anyone could read it and send
notifications as you. The browser gets a **subscriber token** instead:
it only opens **one** user's inbox, and it expires (default 12 hours).

## 2. Send a message

```bash
curl -X POST http://localhost:3000/v1/in-app/send \
  -H "x-api-key: nh_test_..." -H "Content-Type: application/json" \
  -d '{
    "to": { "subscriberId": "user_123", "name": "Sara" },
    "payload": { "orderId": "A42" },
    "title": "Order {{orderId}} shipped",
    "body": "Hi {{subscriber.name}}, your order is on its way.",
    "actionUrl": "/orders/{{orderId}}"
  }'
# → 202 { "status": "queued", "notifications": [{ "channel": "in_app", "notificationId": "..." }] }
```

| Field | Required | Rules |
|---|---|---|
| `to.subscriberId` | yes | **Your** app's id for the user. The inbox is identified by it, no email or phone needed |
| `body` | yes | 1–5,000 characters |
| `title` | no | Up to 200 characters |
| `actionUrl` | no | Where a click leads: a path in your app (`/orders/{{orderId}}`) or a full `http(s)://` URL. The start must be written literally, not as a placeholder, so a payload can never turn it into a `javascript:` link |
| `payload`, `event`, `idempotencyKey` | no | Same as for [email](sending-notifications.md#send-an-email--post-v1emailsend) |

All three fields are templates (`{{orderId}}`, `{{subscriber.name}}`) and are
rendered as **plain text**: your UI must show them as text, never as HTML.

Through the multi-channel endpoint, the same message is `channels.in_app`:

```json
{
  "event": "order-shipped",
  "to": { "subscriberId": "user_123", "email": "sara@example.com" },
  "channels": {
    "email":  { "subject": "Order shipped", "text": "Your order is on its way." },
    "in_app": { "title": "Order shipped", "body": "Your order is on its way." }
  }
}
```

The message goes to the inbox of `user_123` **in the API key's environment**:
messages sent with a `nh_test_` key are only visible with tokens created by a
`nh_test_` key, and the same for `live`.

The notification is `sent` once it is saved in the inbox. A user who is
offline sees it the next time the inbox loads.

## 3. Give the browser a token

When your user opens a page with the inbox, **your backend** asks NotifyHub
for a token and passes it to the page:

```bash
curl -X POST http://localhost:3000/v1/inbox/tokens \
  -H "x-api-key: nh_test_..." -H "Content-Type: application/json" \
  -d '{ "subscriberId": "user_123" }'
# → 201 { "token": "eyJhbGciOi...", "subscriberId": "user_123", "expiresAt": "2026-11-12T09:00:00.000Z" }
```

For example, in an Express backend:

```js
app.get('/api/inbox-token', requireLogin, async (req, res) => {
  const r = await fetch(`${NOTIFYHUB_URL}/v1/inbox/tokens`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.NOTIFYHUB_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ subscriberId: req.user.id }),
  });
  res.json(await r.json());
});
```

Use **your logged-in user's id**: whoever holds the token can read that
inbox. When the token expires, the API answers `401` and the WebSocket
disconnects. Fetch a new token and reconnect.

## 4. Show the inbox in the browser

### Load messages (REST)

All with `Authorization: Bearer <token>`:

| Method | Path | Does |
|---|---|---|
| `GET` | `/v1/inbox/messages?limit=20&before=<cursor>&unreadOnly=false` | Newest first, plus `unreadCount` and `nextCursor` (pass it as `before` for older messages; `null` = no more) |
| `GET` | `/v1/inbox/unread-count` | `{ "unreadCount": 3 }`, for the bell badge |
| `POST` | `/v1/inbox/messages/:id/read` | Mark one read (safe to repeat). Returns the message |
| `POST` | `/v1/inbox/read-all` | Mark all read. Returns `{ "updated": 3, "unreadCount": 0 }` |

A message looks like:

```json
{
  "id": "6af1908f023f5798b0e7849f",
  "title": "Order A42 shipped",
  "body": "Hi Sara, your order is on its way.",
  "actionUrl": "/orders/A42",
  "read": false,
  "readAt": null,
  "createdAt": "2026-11-11T09:00:00.000Z"
}
```

### Receive new messages live (WebSocket)

NotifyHub uses [Socket.IO](https://socket.io/docs/v4/client-installation/)
(`npm install socket.io-client`). Connect to the `/inbox` namespace with the
token:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/inbox', { auth: { token } });

socket.on('notification', ({ message, unreadCount }) => {
  // a new message: add it to the top of the list, update the badge
});
socket.on('unread_count', ({ unreadCount }) => {
  // sent on connect, and when messages are read (e.g. in another tab)
});
socket.on('connect_error', (err) => {
  // "Invalid or expired subscriber token" → get a new token, reconnect
});
```

| Event | Data | When |
|---|---|---|
| `notification` | `{ message, unreadCount }` | A new message arrived |
| `unread_count` | `{ unreadCount }` | Right after connecting, and whenever messages are marked read |

Every open tab of the same user receives the events.

### Try it: the demo page

[`examples/inbox-demo/index.html`](../examples/inbox-demo/index.html) is a
complete inbox in one file. Open it in your browser (double-click it), paste
a token from step 3, click **Connect**, then send messages from step 2 and
watch them appear instantly.

## 5. Settings

| Setting | Default | Description |
|---|---|---|
| `IN_APP_ENABLED` | `true` | `false` disables the in_app channel: sending and new tokens are refused with `400` |
| `INBOX_TOKEN_EXPIRES_IN` | `12h` | How long a subscriber token works: `15m`, `12h`, `7d`... |
| `CORS_ORIGINS` | `*` | Websites allowed to call the API from a browser. In production, list your app: `https://app.example.com` |
| `IN_APP_WORKER_CONCURRENCY` | `10` | Inbox messages saved in parallel per worker process |

Subscriber tokens are signed with a key **derived from `JWT_SECRET`**, so
there is no extra secret to manage. Changing `JWT_SECRET` invalidates all
subscriber tokens (and dashboard logins).

Inbox messages are deleted automatically after **90 days**.

## 6. How it works

1. `POST /v1/in-app/send` saves a notification (`queued`) and adds a job to
   the `notifications.in_app` queue, exactly like email.
2. The worker renders the templates and hands the message to the built-in
   **inbox provider**, which saves it in MongoDB (`inbox_messages`). A retried
   job never creates a second copy.
3. The provider **publishes** the message to Redis. The worker has no WebSocket
   server, so it can't talk to browsers itself.
4. Every API instance runs Socket.IO with the **Redis adapter**: it receives
   the published message and forwards it to that user's open sockets. This
   also works with several API instances behind a load balancer (with sticky
   sessions, see [Scaling](scaling.md#5-step-3-run-more-api-instances)).
5. If Redis publishing fails, the message is still saved: the browser gets it
   on its next load. Live delivery is best effort; the inbox itself is reliable.

## 7. Troubleshooting

| Problem | Cause / fix |
|---|---|
| `400 The in_app channel is not enabled on this server` | `IN_APP_ENABLED=false` in `.env` |
| `400 actionUrl must start with "/"...` | `actionUrl` must begin with `/` or `http(s)://host`, written literally |
| `401 Invalid or expired subscriber token` | Get a new token from `POST /v1/inbox/tokens` |
| Browser: "blocked by CORS policy" | Add your app's origin to `CORS_ORIGINS` (exact, e.g. `http://localhost:5173`, no trailing slash) |
| Inbox connection fails with `400` behind a load balancer | Several API instances need **sticky sessions**, see [Scaling](scaling.md#5-step-3-run-more-api-instances) |
| Messages appear only after a refresh | The WebSocket isn't connected: check `connect_error`, and that the worker and API use the same Redis |
| Messages sent but the inbox is empty | Token and API key are in different environments (`test` vs `live`), or a different `subscriberId` |

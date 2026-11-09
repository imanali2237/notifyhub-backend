# Email providers

NotifyHub doesn't deliver email by itself: it hands each email to a
**provider** — an email service such as Gmail, Brevo or any SMTP server. You
choose the providers in `.env`, and you can list **several**: if the first one
fails, NotifyHub automatically tries the next.

- [Choose your setup](#1-choose-your-setup)
- [Built-in providers](#2-built-in-providers)
- [Set up SMTP (Gmail, Mailpit, any server)](#3-smtp)
- [Set up Brevo](#4-brevo)
- [Use several providers (failover)](#5-several-providers-failover)
- [Check that it works](#6-check-that-it-works)
- [Troubleshooting](#7-troubleshooting)

---

## 1. Choose your setup

Everything is controlled by one setting, `EMAIL_PROVIDERS`: a comma-separated
list of providers, **in the order they are tried**.

| You want | Set | Notes |
|---|---|---|
| **No email at all** | `EMAIL_PROVIDERS=` (empty) | The email channel is disabled; the API rejects email with `400`. Requires `EMAIL_VERIFICATION_REQUIRED=false` (verification codes are sent by email). |
| **One provider** | `EMAIL_PROVIDERS=smtp` | The most common setup. |
| **Several providers** | `EMAIL_PROVIDERS=brevo,smtp` | Brevo first; if it fails, SMTP. See [failover](#5-several-providers-failover). |

Rules, checked when NotifyHub starts (it refuses to start otherwise, with a
message telling you what's wrong):

- each listed provider must have its required settings filled in
- names must be known (`smtp`, `brevo`) and listed only once
- sender addresses must look like `Name <you@example.com>` or `you@example.com`
- `EMAIL_VERIFICATION_REQUIRED=true` needs at least one provider

After changing `.env`, **restart** NotifyHub (settings are read at startup).

The same providers send **everything**: your notifications *and* NotifyHub's
own emails (signup verification codes).

---

## 2. Built-in providers

| Id | Service | How it sends | Required settings |
|---|---|---|---|
| `smtp` | Any SMTP server: Gmail, Mailpit, Brevo SMTP relay, Amazon SES SMTP, Mailgun, your own... | SMTP protocol | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` |
| `brevo` | [Brevo](https://www.brevo.com) (free plan: 300 emails/day) | Brevo REST API | `BREVO_API_KEY`, `BREVO_FROM` |

> **Limitation:** `smtp` can be listed once, so one installation talks to
> **one** SMTP server. To combine two services, use one through `smtp` and the
> other through its own provider (e.g. Gmail via `smtp` + Brevo via `brevo`).
> Want another built-in provider? See [Adding a provider](contributing/adding-a-provider.md).

---

## 3. SMTP

### Settings

| Setting | Required | Default | Meaning |
|---|---|---|---|
| `SMTP_HOST` | yes | — | Server address, e.g. `smtp.gmail.com` |
| `SMTP_PORT` | yes | — | Usually `465` (TLS) or `587` (STARTTLS); `1025` for Mailpit |
| `SMTP_FROM` | yes | — | Sender shown to recipients: `"My App <no-reply@myapp.com>"` |
| `SMTP_SECURE` | no | `false` | `true` for port **465**. Keep `false` for 587 (the connection is upgraded to TLS automatically) and for Mailpit |
| `SMTP_USER` | no | — | Login name. Leave empty if the server needs no login (Mailpit) |
| `SMTP_PASS` | no | — | Password / app password / SMTP key |
| `SMTP_CONNECTION_TIMEOUT_MS` | no | `10000` | Give up connecting after this long (then the next provider is tried) |
| `SMTP_SOCKET_TIMEOUT_MS` | no | `20000` | Give up on a silent connection after this long |

### Mailpit (local testing — the default)

Mailpit runs in Docker with NotifyHub. It accepts every email and shows it at
**http://localhost:8025** without delivering anything — any address works.

```env
EMAIL_PROVIDERS=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="NotifyHub <no-reply@notifyhub.local>"
```

### Gmail

Good for demos and small volumes (a personal account can send roughly 500
emails a day).

1. Turn on **2-Step Verification**: https://myaccount.google.com/security
2. Create an **App Password**: https://myaccount.google.com/apppasswords
   (name it "NotifyHub"). Google shows 16 characters — copy them **without spaces**.
3. Configure:

```env
EMAIL_PROVIDERS=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM="My App <you@gmail.com>"
```

- `SMTP_FROM` must be your Gmail address (or an alias added in Gmail settings);
  Gmail rewrites or rejects other senders.
- Your normal Google password does **not** work here — only an App Password.

### Other SMTP services

Any SMTP server works. Common settings (check your service's documentation —
values can change):

| Service | `SMTP_HOST` | `SMTP_PORT` / `SMTP_SECURE` | Login |
|---|---|---|---|
| Brevo SMTP relay | `smtp-relay.brevo.com` | `587` / `false` | SMTP login + SMTP key (Brevo → SMTP & API → SMTP) |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | `587` / `false` | SES **SMTP credentials** (not your AWS access keys) |
| Mailgun | `smtp.mailgun.org` | `587` / `false` | Domain SMTP credentials |
| Your own server | your host | `587` / `false` or `465` / `true` | as configured |

---

## 4. Brevo

Uses Brevo's REST API. Free plan: 300 emails per day.

1. Create an account at https://www.brevo.com.
2. **Add and verify a sender** (Brevo → Senders, Domains & Dedicated IPs →
   Senders). Brevo only sends from verified senders.
3. **Create an API key** (Brevo → SMTP & API → API Keys → Generate). It looks
   like `xkeysib-...`.
4. Configure:

```env
EMAIL_PROVIDERS=brevo
BREVO_API_KEY=xkeysib-...
BREVO_FROM="My App <hello@myapp.com>"   # must be the sender verified in step 2
```

| Setting | Required | Default | Meaning |
|---|---|---|---|
| `BREVO_API_KEY` | yes | — | Your Brevo API key |
| `BREVO_FROM` | yes | — | Verified sender: `"Name <email>"` or `email` |
| `BREVO_TIMEOUT_MS` | no | `10000` | Max wait for Brevo's API before giving up (then the next provider is tried) |

If Brevo answers `401` mentioning an unrecognised IP address, allow your
server's IP in Brevo's security settings (Authorised IPs).

---

## 5. Several providers (failover)

List more than one provider and NotifyHub tries them **in order** for every
email:

```env
EMAIL_PROVIDERS=brevo,smtp

BREVO_API_KEY=xkeysib-...
BREVO_FROM="My App <hello@myapp.com>"

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM="My App <you@gmail.com>"
```

### What happens when a provider fails

Every failure is sorted into one of three kinds:

| Kind | Examples | What NotifyHub does |
|---|---|---|
| **temporary** | timeout, server down, rate limit (`429`), server error (`5xx` API / `4xx` SMTP) | Tries the **next provider** right away. If *all* fail, the email is retried later (whole list again) with exponential backoff |
| **provider** | wrong API key or password, daily quota used up (Gmail `5.4.5`), unverified sender, account blocked | Tries the **next provider**. Not retried later — it won't fix itself in a few seconds |
| **message** | the recipient doesn't exist (`5.1.1`), invalid address | **Stops.** Every provider would reject it too. Marked `failed` |

```
email → brevo ✗ (timeout)        → smtp ✓  → status "sent", provider "smtp"
email → brevo ✗ (bad key)        → smtp ✓  → status "sent", provider "smtp"
email → brevo ✗ (timeout)        → smtp ✗ (down)  → "retrying" → later: whole list again
email → brevo ✗ (user unknown)   → stop             → "failed"
```

Retry settings (`QUEUE_MAX_ATTEMPTS`, `QUEUE_BACKOFF_DELAY_MS`) are in the
[configuration reference](configuration.md#queues-and-retries).

### Choosing the order

- Put the provider you want to use normally **first**; the others are backups.
- Each provider sends with **its own sender** (`BREVO_FROM`, `SMTP_FROM`), so a
  recipient may see a different "From" when a backup was used. Using addresses
  on the same domain keeps this consistent.
- Free plans have daily limits. Listing two free plans (e.g. Brevo + Gmail)
  means that when one runs out, the other takes over.

---

## 6. Check that it works

**At startup** the API prints the active setup:

```
[Providers] email: brevo → smtp (failover order)
[Providers] email: smtp
[Providers] email: disabled (no providers configured)
```

**Send a test email** to an address you can read (see
[Getting started](getting-started.md#7-send-your-first-email)), then check
which provider delivered it:

```bash
curl http://localhost:3000/v1/notifications/<notificationId> -H "x-api-key: ..."
# → { "status": "sent", "provider": "smtp", "providerMessageId": "<...>", "attempts": 1, ... }
```

The **worker logs** show every attempt:

```
[EmailProcessor] email 6af1...: provider brevo failed (temporary): Brevo unreachable: ...
[EmailProcessor] ✓ email 6af1... sent to sara@example.com via smtp (fallback provider) (attempt 1)
```

**Try failover locally** without a real Brevo account: make Brevo give up
instantly so SMTP (Mailpit) takes over:

```env
EMAIL_PROVIDERS=brevo,smtp
BREVO_API_KEY=anything
BREVO_FROM=test@example.com
BREVO_TIMEOUT_MS=1
```

Send an email: it arrives in Mailpit and the notification shows `"provider": "smtp"`.

---

## 7. Troubleshooting

### NotifyHub doesn't start

The error lists each problem. The common ones:

| Message | Fix |
|---|---|
| `SMTP_HOST is required because EMAIL_PROVIDERS includes "smtp"` | Fill in that provider's settings, or remove it from `EMAIL_PROVIDERS` |
| `Invalid option: expected one of "smtp"\|"brevo"` | Typo in `EMAIL_PROVIDERS`; only built-in ids work |
| `a provider is listed more than once` | Remove the duplicate |
| `BREVO_FROM must look like "Name <you@example.com>" ...` | Fix the sender format |
| `EMAIL_VERIFICATION_REQUIRED=true needs at least one email provider` | Add a provider, or set `EMAIL_VERIFICATION_REQUIRED=false` |

### The API rejects email

`400 The email channel is not enabled on this server` → `EMAIL_PROVIDERS` is
empty. Add a provider and restart.

### Emails end up `failed` or stuck in `retrying`

Read `lastError` on the notification (`GET /v1/notifications/:id`) or the
failed job in the queue dashboard (http://localhost:3000/queues). It lists the
error from **each** provider, e.g. `brevo: Brevo 401: Key not found; smtp: connect ECONNREFUSED`.

| Error contains | Meaning | Fix |
|---|---|---|
| `ECONNREFUSED` | Nothing listening at `SMTP_HOST:SMTP_PORT` | Check host/port; for Mailpit, run `npm run infra:up` |
| `ETIMEDOUT`, `Greeting never received` | Server unreachable or port blocked | Many hosting providers block outgoing SMTP ports; try 587, or use an API provider like `brevo` |
| `Invalid login`, `535`, `Username and Password not accepted` | Wrong SMTP login | Gmail: use an **App Password**; check `SMTP_USER`/`SMTP_PASS` |
| `wrong version number` / TLS errors | `SMTP_SECURE` doesn't match the port | `465` → `true`, `587`/`25`/`1025` → `false` |
| `5.4.5`, `quota`, `limit exceeded` | Daily sending limit reached | Wait, or add a second provider for failover |
| `5.1.1`, `User unknown`, `mailbox unavailable` | The recipient doesn't exist | Fix the address; this is never retried |
| `Brevo 401` | Invalid API key, or your IP isn't authorised | New key; allow the IP in Brevo security settings |
| `Brevo 400` | Usually: sender not verified | Verify `BREVO_FROM` in Brevo |
| `Brevo 402` | No credits / plan limit | Check your Brevo plan |
| `Brevo unreachable` | Network problem or timeout | Check the server's internet access; raise `BREVO_TIMEOUT_MS` |

### Email "sent" but not received

`sent` means the provider **accepted** it. If it doesn't arrive:

- check the **spam** folder
- with Mailpit, emails never leave your machine — look at http://localhost:8025
- `@example.com` addresses don't exist; use an inbox you own
- for production volume, send from your own domain with SPF/DKIM set up at
  your provider — this is what keeps email out of spam

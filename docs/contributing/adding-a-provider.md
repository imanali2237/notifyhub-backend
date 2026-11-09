# Adding a provider or a channel

NotifyHub is built so that new **providers** (another email service) and new
**channels** (SMS, Telegram...) plug in without touching the core: the trigger
API, queues, retries, failover and status tracking work for anything that
follows the contracts below.

- **Provider** = one service that delivers one channel (Brevo for email, Twilio for SMS).
- **Channel** = a kind of message (email, SMS, chat), with its own queue and request fields.

## How a provider fits in

```
worker ──► ProviderRegistry.send('email', message)
              tries providers in the operator's EMAIL_PROVIDERS order
              ├─ BrevoEmailProvider.send()  → SendResult
              └─ SmtpEmailProvider.send()   → SendResult
```

Every provider implements `ChannelProvider` (`src/providers/providers.interfaces.ts`):

```ts
interface ChannelProvider<TMessage> {
  readonly id: string;        // used in EMAIL_PROVIDERS and stored on notifications
  readonly channel: Channel;  // 'email'
  send(message: TMessage): Promise<SendResult>;
}

type SendResult =
  | { success: true; providerMessageId?: string }
  | { success: false; failure: 'temporary' | 'provider' | 'message'; error: string };
```

`send()` must **not throw** — catch errors and return them. The `failure` kind
drives everything that happens next:

| `failure` | Use it when | Effect |
|---|---|---|
| `temporary` | Network error, timeout, rate limit, server error | Next provider now; whole list retried later |
| `provider` | This account can't send: bad credentials, quota, blocked, unverified sender | Next provider now; no later retry |
| `message` | The message itself is rejected: recipient doesn't exist, invalid content | Stop: no other provider, no retry |

When unsure between `provider` and `message`, choose `provider`: trying one
more provider is cheaper than dropping an email another service would deliver.

## Adding an email provider (example: Amazon SES API)

### 1. Write the class — `src/providers/email/ses-email.provider.ts`

```ts
import type { ConfigService } from '@nestjs/config';
import type { EmailMessage } from '../../channels/email/email.interfaces.js';
import type { Env } from '../../config/env.js';
import type { ChannelProvider, SendResult } from '../providers.interfaces.js';

export class SesEmailProvider implements ChannelProvider<EmailMessage> {
  readonly id = 'ses';
  readonly channel = 'email' as const;

  constructor(config: ConfigService<Env, true>) {
    // read SES_* settings from config
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const id = await /* call the SES API with message.to, subject, html, text */;
      return { success: true, providerMessageId: id };
    } catch (err) {
      return { success: false, failure: classify(err), error: (err as Error).message };
    }
  }
}
```

Use `src/providers/email/brevo-email.provider.ts` as a reference: it uses
`fetch` with a timeout (no SDK needed) and maps HTTP status codes to failure
kinds in a small exported function that is easy to unit-test.

### 2. Register its id and required settings — `src/providers/email/email-provider.constants.ts`

```ts
export const EMAIL_PROVIDER_IDS = ['smtp', 'brevo', 'ses'] as const;

export const EMAIL_PROVIDER_REQUIRED_SETTINGS = {
  smtp: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'],
  brevo: ['BREVO_API_KEY', 'BREVO_FROM'],
  ses: ['SES_REGION', 'SES_ACCESS_KEY_ID', 'SES_SECRET_ACCESS_KEY', 'SES_FROM'],
};
```

With this, startup fails clearly if an operator lists `ses` without its settings.

### 3. Declare the settings — `src/config/env.ts`

```ts
SES_REGION: optionalString(),
SES_ACCESS_KEY_ID: optionalString(),
SES_SECRET_ACCESS_KEY: optionalString(),
SES_FROM: optionalString(),
SES_TIMEOUT_MS: int(DEFAULTS.SES_TIMEOUT_MS), // default in config.defaults.ts
```

Keep provider settings **optional** in the schema — they're only required when
the provider is listed (step 2 handles that). If it has a sender address, add
it to the format check in the `superRefine` block.

### 4. Add it to the catalog — `src/providers/providers.catalog.ts`

```ts
export const EMAIL_PROVIDER_CATALOG = {
  smtp: (config) => new SmtpEmailProvider(config),
  brevo: (config) => new BrevoEmailProvider(config),
  ses: (config) => new SesEmailProvider(config),
};
```

TypeScript reports an error here until the id from step 2 has a factory.

### 5. Test it — `src/providers/email/ses-email.provider.spec.ts`

Mock the network (`vi.spyOn(globalThis, 'fetch')` or the SDK client) and cover:
the request sent, success, and one case per failure kind. See
`brevo-email.provider.spec.ts`. Never call the real service from tests.

### 6. Document it (same pull request)

- `docs/email-providers.md`: add it to the [built-in providers](../email-providers.md#2-built-in-providers)
  table and give it a setup section (account, keys, sender, settings, common errors)
- `docs/configuration.md`: its settings
- `.env.example`: a commented section like Brevo's

Operators can then use `EMAIL_PROVIDERS=ses` or `EMAIL_PROVIDERS=ses,smtp`.
Nothing else changes: worker, queues, retries, failover and the API already
work with it.

## Adding a channel (example: SMS)

Follow the checklist in [`src/channels/README.md`](../../src/channels/README.md):
channel name and queue, handler (recipient field, template fields, content
rules), request DTO, providers (with an `SMS_PROVIDERS` list built the same way
as `EMAIL_PROVIDERS`), and a worker processor. Then add a `docs/sms.md` page
and update [the docs index](../README.md).

## Before opening a pull request

```bash
npm run lint && npm test && npm run test:e2e   # e2e needs `npm run infra:up`
npx prettier --check src test
```

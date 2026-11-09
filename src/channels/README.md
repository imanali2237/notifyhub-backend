# Channels

The core (trigger API, queues, worker lifecycle, renderer, provider registry) is
channel-agnostic. A channel is described once by a `ChannelHandler`, and
everything else is driven by it.

## Adding a new channel (example: SMS)

1. **Name + queue** — `channels/channels.constants.ts`

   ```ts
   export const CHANNELS = ['email', 'sms'] as const;
   CHANNEL_QUEUES.sms = 'notifications.sms';
   CHANNEL_CONCURRENCY.sms = 10;
   ```

   TypeScript now fails to compile until steps 2–5 are done (`Record<Channel, …>`).

2. **Handler** — `channels/sms/sms.channel.ts` (+ `sms.interfaces.ts` for `SmsMessage`)

   ```ts
   export const smsChannel: ChannelHandler<SmsMessage> = {
     channel: 'sms',
     recipientField: 'phone',
     templateFields: { text: 'plain' },
     validateContent: (c) => (c.text ? null : 'channels.sms needs text'),
     buildMessage: (to, r) => ({ to, text: r.text ?? '' }),
   };
   ```

   Register it in `channels/channel-handlers.ts`.

3. **Request body** — `events/dto/channels/sms-content.dto.ts`, then add the
   `sms?: SmsContentDto` field to `ChannelsContentDto`.

4. **Provider(s)** — `providers/sms/console-sms.provider.ts` implementing
   `ChannelProvider<SmsMessage>` with `channel = 'sms'`. Then:
   - add an `SMS_PROVIDERS` list to `config/env.ts` (like `EMAIL_PROVIDERS`)
     plus each provider's required settings
   - add the providers to `providers/providers.catalog.ts`
     (`buildEnabledProviders` reads `SMS_PROVIDERS`)

5. **Processor** — `worker/processors/sms.processor.ts`
   ```ts
   @Processor(CHANNEL_QUEUES.sms, { concurrency: CHANNEL_CONCURRENCY.sms })
   export class SmsProcessor extends ChannelProcessor {
     protected readonly channel = 'sms' as const;
   }
   ```
   Add it to `PROCESSORS` in `worker/worker.module.ts`.

No changes needed in: `EventsService`, `NotificationsService`, the Notification
schema, `NotificationQueueService`, `ChannelProcessor`, or the template renderer.

## Adding a provider to an existing channel

See [docs/contributing/adding-a-provider.md](../../docs/contributing/adding-a-provider.md)
(contract, failure kinds, step-by-step example, tests, docs to update).

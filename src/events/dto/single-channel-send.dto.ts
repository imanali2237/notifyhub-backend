import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, Matches, MaxLength } from 'class-validator';
import { EVENT_NAME_PATTERN } from '../events.constants.js';
import { TriggerEventDto } from './trigger-event.dto.js';

/**
 * Shared fields of every per-channel endpoint (POST /v1/email/send, later
 * /v1/sms/send...): `to`, `payload`, `idempotencyKey` — same rules as the
 * trigger endpoint, but no `channels` wrapper and `event` is optional.
 *
 * Each channel's DTO = this + that channel's content DTO (see SendEmailDto).
 */
export class SingleChannelSendDto extends OmitType(TriggerEventDto, [
  'channels',
  'event',
] as const) {
  @ApiPropertyOptional({
    description:
      'Name of what happened in your app (shown in logs). Defaults to "<channel>.send", e.g. "email.send".',
    example: 'order-shipped',
    pattern: EVENT_NAME_PATTERN.source,
    maxLength: 100,
  })
  @IsOptional()
  @Matches(EVENT_NAME_PATTERN, {
    message: 'event must look like "order-shipped" (lowercase, digits, - _ .)',
  })
  @MaxLength(100)
  event?: string;
}

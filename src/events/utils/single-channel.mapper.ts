import type { Channel } from '../../channels/channels.constants.js';
import type { ChannelsContentDto } from '../dto/channels/channels-content.dto.js';
import type { SingleChannelSendDto } from '../dto/single-channel-send.dto.js';
import type { TriggerEventDto } from '../dto/trigger-event.dto.js';

/**
 * Turns a per-channel request (e.g. POST /v1/email/send) into the same shape
 * as POST /v1/events/trigger, so both go through one pipeline: validation,
 * idempotency, saving, queueing and the worker behave exactly the same.
 */
export function toTriggerEvent<C extends Channel>(
  channel: C,
  dto: SingleChannelSendDto,
  content: NonNullable<ChannelsContentDto[C]>,
): TriggerEventDto {
  return {
    event: dto.event ?? `${channel}.send`,
    to: dto.to,
    payload: dto.payload,
    idempotencyKey: dto.idempotencyKey,
    channels: { [channel]: content },
  };
}

import { ApiProperty } from '@nestjs/swagger';
import {
  CHANNELS,
  type Channel,
} from '../../../channels/channels.constants.js';

export class TriggeredNotificationDto {
  @ApiProperty({ enum: CHANNELS, example: 'email' })
  channel: Channel;

  @ApiProperty({
    description: 'Use with GET /v1/notifications/{id}',
    example: '6af1908f023f5798b0e7849f',
  })
  notificationId: string;
}

export class TriggerResponseDto {
  @ApiProperty({
    enum: ['queued', 'duplicate'],
    description:
      '`queued` (202): accepted, will be sent shortly. `duplicate` (200): this idempotencyKey was already used — nothing re-sent.',
    example: 'queued',
  })
  status: 'queued' | 'duplicate';

  @ApiProperty({
    format: 'uuid',
    description: 'Groups the notifications created by this trigger',
    example: 'fe568927-5d47-4346-99c6-d05e81badd55',
  })
  transactionId: string;

  @ApiProperty({
    type: [TriggeredNotificationDto],
    description: 'One per channel',
  })
  notifications: TriggeredNotificationDto[];
}

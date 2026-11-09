import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHANNELS, type Channel } from '../../channels/channels.constants.js';
import { RecipientDto } from '../../events/dto/recipient.dto.js';
import { NOTIFICATION_STATUSES } from '../notifications.constants.js';
import type { NotificationStatus } from '../notifications.interfaces.js';

export class NotificationEventDto {
  @ApiProperty({ enum: NOTIFICATION_STATUSES, example: 'sent' })
  status: NotificationStatus;

  @ApiProperty({ type: Date, example: '2026-11-09T08:51:26.000Z' })
  at: Date;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      provider: 'smtp',
      providerMessageId: '<b8933…@notifyhub.local>',
    },
  })
  meta?: Record<string, unknown>;
}

const CONTENT_EXAMPLE = {
  subject: 'Order {{orderId}} shipped',
  html: '<p>Hi {{subscriber.name}}</p>',
};

export class NotificationResponseDto {
  @ApiProperty({ example: '6af1908f023f5798b0e7849f' })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: 'fe568927-5d47-4346-99c6-d05e81badd55',
  })
  transactionId: string;

  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiProperty({ enum: ['test', 'live'], example: 'live' })
  environment: 'test' | 'live';

  @ApiProperty({ example: 'order-shipped' })
  event: string;

  @ApiProperty({ enum: CHANNELS, example: 'email' })
  channel: Channel;

  @ApiProperty({ type: RecipientDto })
  recipient: RecipientDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { orderId: 'A42' },
  })
  payload: Record<string, unknown>;

  @ApiProperty({
    description: 'Templates as received (channel-specific fields)',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: CONTENT_EXAMPLE,
  })
  content: Record<string, string>;

  @ApiPropertyOptional({
    description: 'What was actually sent, after rendering. Set once sent.',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { subject: 'Order A42 shipped', html: '<p>Hi Sara</p>' },
  })
  rendered?: Record<string, string>;

  @ApiProperty({ enum: NOTIFICATION_STATUSES, example: 'sent' })
  status: NotificationStatus;

  @ApiProperty({ description: 'Send attempts so far', example: 1 })
  attempts: number;

  @ApiPropertyOptional({ example: 'connect ECONNREFUSED 127.0.0.1:1025' })
  lastError?: string;

  @ApiPropertyOptional({
    description: 'Provider that sent it',
    example: 'smtp',
  })
  provider?: string;

  @ApiPropertyOptional({
    example: '<b893348f-43a4-fe23-6f3e-c1e2f2a15599@notifyhub.local>',
  })
  providerMessageId?: string;

  @ApiPropertyOptional({ example: 'order-A42-shipped' })
  idempotencyKey?: string;

  @ApiProperty({
    type: [NotificationEventDto],
    description: 'Every status change, oldest first',
  })
  events: NotificationEventDto[];

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}

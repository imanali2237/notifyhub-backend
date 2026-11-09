import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EVENT_NAME_PATTERN } from '../events.constants.js';
import { ChannelsContentDto } from './channels/channels-content.dto.js';
import { RecipientDto } from './recipient.dto.js';

export class TriggerEventDto {
  @ApiProperty({
    description:
      'Name of what happened in your app. Lowercase letters/digits separated by - _ or .',
    example: 'order-shipped',
    pattern: EVENT_NAME_PATTERN.source,
    maxLength: 100,
  })
  @Matches(EVENT_NAME_PATTERN, {
    message: 'event must look like "order-shipped" (lowercase, digits, - _ .)',
  })
  @MaxLength(100)
  event: string;

  @ApiProperty({ type: RecipientDto })
  @ValidateNested()
  @Type(() => RecipientDto)
  to: RecipientDto;

  @ApiPropertyOptional({
    description: 'Values for the {{placeholders}} in every channel’s templates',
    type: 'object',
    additionalProperties: true,
    example: { orderId: 'A42', eta: 'Tomorrow' },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiProperty({
    description: 'At least one channel. Each creates its own notification.',
    type: ChannelsContentDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelsContentDto)
  channels: ChannelsContentDto;

  @ApiPropertyOptional({
    description:
      'Send the same key again (within IDEMPOTENCY_TTL_SECONDS, default 24h) and nothing is re-sent — safe to retry.',
    example: 'order-A42-shipped',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  idempotencyKey?: string;
}

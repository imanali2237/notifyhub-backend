import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  IN_APP_ACTION_URL_MAX_LENGTH,
  IN_APP_ACTION_URL_PATTERN,
  IN_APP_BODY_MAX_LENGTH,
  IN_APP_TITLE_MAX_LENGTH,
} from '../../../inbox/inbox.constants.js';

/**
 * Handlebars templates for an in-app inbox message. Placeholders come from
 * `payload`, plus {{subscriber.name}}. Plain text: the inbox shows it as text.
 */
export class InAppContentDto {
  @ApiPropertyOptional({
    example: 'Order {{orderId}} shipped',
    maxLength: IN_APP_TITLE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(IN_APP_TITLE_MAX_LENGTH)
  title?: string;

  @ApiProperty({
    example: 'Hi {{subscriber.name}}, it arrives {{eta}}.',
    minLength: 1,
    maxLength: IN_APP_BODY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(IN_APP_BODY_MAX_LENGTH)
  body: string;

  @ApiPropertyOptional({
    description:
      'Where the message leads when clicked: a path in your app ("/orders/{{orderId}}") or a full http(s) URL. The start must be written literally (not a placeholder).',
    example: '/orders/{{orderId}}',
    maxLength: IN_APP_ACTION_URL_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(IN_APP_ACTION_URL_MAX_LENGTH)
  @Matches(IN_APP_ACTION_URL_PATTERN, {
    message:
      'actionUrl must start with "/" (a path in your app) or http:// / https:// followed by a host',
  })
  actionUrl?: string;
}

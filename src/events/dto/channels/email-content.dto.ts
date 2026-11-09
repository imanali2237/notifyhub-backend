import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Handlebars templates. Placeholders come from `payload`, plus
 * {{subscriber.name}} / {{subscriber.email}}. Send `html`, `text`, or both.
 */
export class EmailContentDto {
  @ApiProperty({
    example: 'Order {{orderId}} shipped',
    minLength: 1,
    maxLength: 998,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(998) // max line length allowed by the email standard
  subject: string;

  @ApiPropertyOptional({
    description: 'Values inserted here are HTML-escaped',
    example:
      '<p>Hi {{subscriber.name}}, order <b>{{orderId}}</b> arrives {{eta}}.</p>',
    maxLength: 500_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  html?: string;

  @ApiPropertyOptional({
    description: 'Plain-text version (shown by clients that block HTML)',
    example: 'Hi {{subscriber.name}}, order {{orderId}} arrives {{eta}}.',
    maxLength: 100_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  text?: string;
}

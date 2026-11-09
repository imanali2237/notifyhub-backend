import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';
import { E164_PHONE_PATTERN } from '../events.constants.js';

/**
 * Who receives the notification. Contact fields are optional here; each channel
 * requires the one it needs (email channel → email, sms channel → phone).
 */
export class RecipientDto {
  @ApiProperty({
    description: "Your app's own id for this user",
    example: 'user_123',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subscriberId: string;

  @ApiPropertyOptional({
    description: 'Required when sending on the `email` channel',
    example: 'sara@example.com',
  })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'E.164 format. Required by phone channels (e.g. SMS).',
    example: '+923001234567',
    pattern: E164_PHONE_PATTERN.source,
  })
  @IsOptional()
  @Matches(E164_PHONE_PATTERN, {
    message: 'phone must be in E.164 format, e.g. +923001234567',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Available in templates as {{subscriber.name}}',
    example: 'Sara',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

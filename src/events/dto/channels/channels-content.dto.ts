import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { EmailContentDto } from './email-content.dto.js';

/**
 * Content per channel. Send one or several; each creates its own notification.
 * Unknown channels are rejected by the ValidationPipe (forbidNonWhitelisted).
 */
export class ChannelsContentDto {
  @ApiPropertyOptional({ type: EmailContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailContentDto)
  email?: EmailContentDto;

  // New channel → add its content DTO here, e.g.:
  // @ApiPropertyOptional({ type: SmsContentDto })
  // @IsOptional() @ValidateNested() @Type(() => SmsContentDto) sms?: SmsContentDto;
}

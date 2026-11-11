import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { EmailContentDto } from './email-content.dto.js';
import { InAppContentDto } from './in-app-content.dto.js';

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

  @ApiPropertyOptional({
    type: InAppContentDto,
    description: "A message in the subscriber's in-app inbox",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InAppContentDto)
  in_app?: InAppContentDto;

  // New channel → add its content DTO here, the same way.
}

import { IntersectionType } from '@nestjs/swagger';
import { EmailContentDto } from './channels/email-content.dto.js';
import { SingleChannelSendDto } from './single-channel-send.dto.js';

/**
 * Body of POST /v1/email/send — the shared fields plus the email content
 * (subject, html, text) at the top level:
 *
 *   { "to": { "subscriberId": "u1", "email": "sara@example.com" },
 *     "subject": "Hi", "text": "Hello!" }
 */
export class SendEmailDto extends IntersectionType(
  SingleChannelSendDto,
  EmailContentDto,
) {}

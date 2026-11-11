import { IntersectionType } from '@nestjs/swagger';
import { InAppContentDto } from './channels/in-app-content.dto.js';
import { SingleChannelSendDto } from './single-channel-send.dto.js';

/**
 * Body of POST /v1/in-app/send — the shared fields plus the message
 * (title, body, actionUrl) at the top level:
 *
 *   { "to": { "subscriberId": "user_123" },
 *     "title": "Welcome!", "body": "Thanks for joining." }
 */
export class SendInAppDto extends IntersectionType(
  SingleChannelSendDto,
  InAppContentDto,
) {}

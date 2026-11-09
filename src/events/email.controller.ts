import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { ApiKeyContext } from '../api-keys/api-keys.interfaces.js';
import { CurrentTenant } from '../api-keys/decorators/current-tenant.decorator.js';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard.js';
import { ApiErrorResponses } from '../common/swagger/api-error-responses.decorator.js';
import {
  API_KEY_SECURITY,
  API_TAGS,
} from '../common/swagger/swagger.constants.js';
import { TriggerResponseDto } from './dto/responses/trigger.response.js';
import { SendEmailDto } from './dto/send-email.dto.js';
import { EventsService } from './events.service.js';
import { toTriggerEvent } from './utils/single-channel.mapper.js';
import { triggerHttpStatus } from './utils/trigger-http-status.js';

/**
 * Email-only endpoint. A thin wrapper over the trigger pipeline — same
 * validation, idempotency, queue and worker as POST /v1/events/trigger.
 */
@ApiTags(API_TAGS.email)
@ApiSecurity(API_KEY_SECURITY)
@Controller('v1/email')
@UseGuards(ApiKeyGuard)
export class EmailController {
  constructor(private readonly events: EventsService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send an email',
    description: [
      'Shortcut for `POST /v1/events/trigger` with only the email channel: `subject`, `html` and `text` go at the top level instead of under `channels.email`.',
      '',
      '- `to.email` is required; send `html`, `text`, or both.',
      '- Templates use Handlebars: `{{orderId}}` comes from `payload`, `{{subscriber.name}}` from `to`.',
      '- Pass an `idempotencyKey` to make retries of this call safe.',
      '- Track progress with `GET /v1/notifications/{notificationId}`.',
    ].join('\n'),
  })
  @ApiAcceptedResponse({
    type: TriggerResponseDto,
    description: 'Queued — will be sent shortly',
  })
  @ApiOkResponse({
    type: TriggerResponseDto,
    description:
      'Duplicate — this idempotencyKey was already used; returns the original notification, nothing re-sent',
  })
  @ApiErrorResponses({
    400: 'Invalid body, email channel not enabled, missing to.email, no html/text, or invalid template syntax',
    401: 'Missing, invalid or revoked API key',
    503: 'Queue/Redis temporarily unavailable — safe to retry',
  })
  async send(
    @CurrentTenant() ctx: ApiKeyContext,
    @Body() dto: SendEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { subject, html, text } = dto;
    const result = await this.events.trigger(
      ctx,
      toTriggerEvent('email', dto, { subject, html, text }),
    );
    res.status(triggerHttpStatus(result));
    return result;
  }
}

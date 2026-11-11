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
import { SendInAppDto } from './dto/send-in-app.dto.js';
import { EventsService } from './events.service.js';
import { toTriggerEvent } from './utils/single-channel.mapper.js';
import { triggerHttpStatus } from './utils/trigger-http-status.js';

/**
 * In-app only endpoint: puts a message in the subscriber's inbox (shown live in
 * your app). A thin wrapper over the trigger pipeline, like /v1/email/send.
 */
@ApiTags(API_TAGS.inApp)
@ApiSecurity(API_KEY_SECURITY)
@Controller('v1/in-app')
@UseGuards(ApiKeyGuard)
export class InAppController {
  constructor(private readonly events: EventsService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send an in-app message',
    description: [
      'Shortcut for `POST /v1/events/trigger` with only the in_app channel: `title`, `body` and `actionUrl` go at the top level instead of under `channels.in_app`.',
      '',
      "- Only `to.subscriberId` is needed: the message goes to that user's inbox in your app.",
      '- Connected browsers get it instantly over the WebSocket; others see it on their next load.',
      '- Templates use Handlebars: `{{orderId}}` comes from `payload`, `{{subscriber.name}}` from `to`.',
      '- Pass an `idempotencyKey` to make retries of this call safe.',
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
    400: 'Invalid body, in-app channel not enabled, empty body, bad actionUrl, or invalid template syntax',
    401: 'Missing, invalid or revoked API key',
    503: 'Queue/Redis temporarily unavailable — safe to retry',
  })
  async send(
    @CurrentTenant() ctx: ApiKeyContext,
    @Body() dto: SendInAppDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { title, body, actionUrl } = dto;
    const result = await this.events.trigger(
      ctx,
      toTriggerEvent('in_app', dto, { title, body, actionUrl }),
    );
    res.status(triggerHttpStatus(result));
    return result;
  }
}

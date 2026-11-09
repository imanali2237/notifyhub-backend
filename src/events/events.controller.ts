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
import { TriggerEventDto } from './dto/trigger-event.dto.js';
import { EventsService } from './events.service.js';
import { triggerHttpStatus } from './utils/trigger-http-status.js';

@ApiTags(API_TAGS.events)
@ApiSecurity(API_KEY_SECURITY)
@Controller('v1/events')
@UseGuards(ApiKeyGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post('trigger')
  @ApiOperation({
    summary: 'Trigger a notification',
    description: [
      'Validates the request, saves one notification **per channel** (status `queued`), puts them on the channel queues and returns immediately — the worker sends them in the background.',
      '',
      '- Templates use Handlebars: `{{orderId}}` comes from `payload`, `{{subscriber.name}}` from `to`.',
      '- Failed sends are retried with exponential backoff (QUEUE_MAX_ATTEMPTS, default 5).',
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
      'Duplicate — this idempotencyKey was already used; returns the original notifications, nothing re-sent',
  })
  @ApiErrorResponses({
    400: 'Invalid body, unknown channel, missing recipient address (e.g. to.email for the email channel), or invalid template syntax',
    401: 'Missing, invalid or revoked API key',
    503: 'Queue/Redis temporarily unavailable — safe to retry',
  })
  async trigger(
    @CurrentTenant() ctx: ApiKeyContext,
    @Body() dto: TriggerEventDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.events.trigger(ctx, dto);
    res.status(triggerHttpStatus(result));
    return result;
  }
}

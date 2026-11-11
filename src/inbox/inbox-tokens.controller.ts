import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiKeyContext } from '../api-keys/api-keys.interfaces.js';
import { CurrentTenant } from '../api-keys/decorators/current-tenant.decorator.js';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard.js';
import { ApiErrorResponses } from '../common/swagger/api-error-responses.decorator.js';
import {
  API_KEY_SECURITY,
  API_TAGS,
} from '../common/swagger/swagger.constants.js';
import type { Env } from '../config/env.js';
import { CreateInboxTokenDto } from './dto/create-inbox-token.dto.js';
import { InboxTokenResponseDto } from './dto/responses/inbox.responses.js';
import { InboxTokenService } from './inbox-token.service.js';

/** Called by YOUR BACKEND (API key), never by the browser. */
@ApiTags(API_TAGS.inbox)
@ApiSecurity(API_KEY_SECURITY)
@Controller('v1/inbox')
@UseGuards(ApiKeyGuard)
export class InboxTokensController {
  private readonly enabled: boolean;

  constructor(
    private readonly tokens: InboxTokenService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('IN_APP_ENABLED');
  }

  @Post('tokens')
  @ApiOperation({
    summary: 'Create a subscriber token (for the inbox UI)',
    description: [
      'Call this **from your backend** when your user loads a page with the inbox, then pass the token to the browser.',
      '',
      'The browser uses it as `Authorization: Bearer <token>` for the `/v1/inbox/*` routes, and as `auth: { token }` when connecting to the `/inbox` WebSocket.',
      'It only gives access to this one subscriber’s inbox, in this API key’s environment (test/live).',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: InboxTokenResponseDto })
  @ApiErrorResponses({
    400: 'Invalid body, or the in-app channel is not enabled on this server',
    401: 'Missing, invalid or revoked API key',
  })
  async create(
    @CurrentTenant() ctx: ApiKeyContext,
    @Body() dto: CreateInboxTokenDto,
  ): Promise<InboxTokenResponseDto> {
    if (!this.enabled) {
      throw new BadRequestException(
        'The in_app channel is not enabled on this server',
      );
    }
    const { token, expiresAt } = await this.tokens.issue(ctx, dto.subscriberId);
    return { token, subscriberId: dto.subscriberId, expiresAt };
  }
}

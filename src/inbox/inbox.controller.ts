import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/swagger/api-error-responses.decorator.js';
import {
  API_TAGS,
  SUBSCRIBER_SECURITY,
} from '../common/swagger/swagger.constants.js';
import { CurrentSubscriber } from './decorators/current-subscriber.decorator.js';
import { ListInboxQuery } from './dto/list-inbox.query.js';
import {
  InboxMessageResponseDto,
  InboxPageResponseDto,
  MarkAllReadResponseDto,
  UnreadCountResponseDto,
} from './dto/responses/inbox.responses.js';
import { SubscriberAuthGuard } from './guards/subscriber-auth.guard.js';
import { InboxRealtimeService } from './inbox-realtime.service.js';
import type { SubscriberContext } from './inbox.interfaces.js';
import { InboxService } from './inbox.service.js';

const AUTH_ERROR = { 401: 'Missing, invalid or expired subscriber token' };

/**
 * The inbox UI's API, called from the BROWSER with a subscriber token.
 * Everything is scoped to the token's subscriber.
 */
@ApiTags(API_TAGS.inbox)
@ApiBearerAuth(SUBSCRIBER_SECURITY)
@Controller('v1/inbox')
@UseGuards(SubscriberAuthGuard)
export class InboxController {
  constructor(
    private readonly inbox: InboxService,
    private readonly realtime: InboxRealtimeService,
  ) {}

  @Get('messages')
  @ApiOperation({
    summary: 'List inbox messages',
    description:
      'Newest first, with the unread count. Load older messages with `before=<nextCursor>`.',
  })
  @ApiOkResponse({ type: InboxPageResponseDto })
  @ApiErrorResponses({ 400: 'Invalid query', ...AUTH_ERROR })
  list(
    @CurrentSubscriber() sub: SubscriberContext,
    @Query() query: ListInboxQuery,
  ): Promise<InboxPageResponseDto> {
    return this.inbox.list(sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Number of unread messages (for the bell badge)' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ApiErrorResponses(AUTH_ERROR)
  async unreadCount(
    @CurrentSubscriber() sub: SubscriberContext,
  ): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.inbox.unreadCount(sub) };
  }

  @Post('messages/:id/read')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark one message read',
    description:
      'Safe to call twice. Other open tabs get the new unread count over the WebSocket.',
  })
  @ApiParam({ name: 'id', example: '6af1908f023f5798b0e7849f' })
  @ApiOkResponse({ type: InboxMessageResponseDto })
  @ApiErrorResponses({ ...AUTH_ERROR, 404: 'No such message in this inbox' })
  async markRead(
    @CurrentSubscriber() sub: SubscriberContext,
    @Param('id') id: string,
  ): Promise<InboxMessageResponseDto> {
    const message = await this.inbox.markRead(sub, id);
    if (!message) throw new NotFoundException('Message not found');
    this.realtime.unreadCount(sub, await this.inbox.unreadCount(sub));
    return message;
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark every message read' })
  @ApiOkResponse({ type: MarkAllReadResponseDto })
  @ApiErrorResponses(AUTH_ERROR)
  async markAllRead(
    @CurrentSubscriber() sub: SubscriberContext,
  ): Promise<MarkAllReadResponseDto> {
    const updated = await this.inbox.markAllRead(sub);
    const unreadCount = await this.inbox.unreadCount(sub);
    this.realtime.unreadCount(sub, unreadCount);
    return { updated, unreadCount };
  }
}

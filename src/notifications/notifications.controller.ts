import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { NotificationResponseDto } from './dto/notification.response.js';
import { toNotificationResponse } from './notification.mapper.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags(API_TAGS.notifications)
@ApiSecurity(API_KEY_SECURITY)
@Controller('v1/notifications')
@UseGuards(ApiKeyGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get a notification',
    description:
      'Current status plus the full history of status changes (`events`). Lifecycle: queued → processing → sent, or → retrying → … → failed.',
  })
  @ApiParam({
    name: 'id',
    description: 'notificationId from the trigger response',
    example: '6af1908f023f5798b0e7849f',
  })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiErrorResponses({
    401: 'Missing, invalid or revoked API key',
    404: 'Not found, or belongs to another tenant',
  })
  async findOne(
    @CurrentTenant() ctx: ApiKeyContext,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notifications.findForTenant(
      ctx.tenantId,
      id,
    );
    if (!notification) throw new NotFoundException('Notification not found');
    return toNotificationResponse(notification);
  }
}

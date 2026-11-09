import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsModule } from './notifications.module.js';

/** HTTP routes for notifications (API process only). */
@Module({
  imports: [NotificationsModule, ApiKeysModule],
  controllers: [NotificationsController],
})
export class NotificationsApiModule {}

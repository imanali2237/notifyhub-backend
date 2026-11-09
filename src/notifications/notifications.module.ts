import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service.js';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema.js';

/**
 * Data layer only (schema + service), no HTTP routes — so the worker can import
 * it without pulling in guards, JWT, etc. Routes live in NotificationsApiModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { QueuesModule } from '../queues/queues.module.js';
import { EmailController } from './email.controller.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [ApiKeysModule, NotificationsModule, QueuesModule],
  controllers: [EventsController, EmailController],
  providers: [EventsService],
})
export class EventsModule {}

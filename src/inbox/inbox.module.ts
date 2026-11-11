import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InboxRealtimeService } from './inbox-realtime.service.js';
import { InboxService } from './inbox.service.js';
import {
  InboxMessage,
  InboxMessageSchema,
} from './schemas/inbox-message.schema.js';

/**
 * Inbox data + realtime publishing, no HTTP — so the worker can import it.
 * Routes, subscriber tokens and the WebSocket gateway live in InboxApiModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InboxMessage.name, schema: InboxMessageSchema },
    ]),
  ],
  providers: [InboxService, InboxRealtimeService],
  exports: [InboxService, InboxRealtimeService],
})
export class InboxModule {}

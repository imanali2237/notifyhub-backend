import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { MongoModule } from '../database/mongo.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { QueuesModule } from '../queues/queues.module.js';
import { EmailProcessor } from './processors/email.processor.js';

/** One processor per channel. New channel → add its processor here. */
const PROCESSORS = [EmailProcessor];

/**
 * Everything the worker process needs — and nothing it doesn't
 * (no HTTP, no auth, no Postgres yet).
 */
@Module({
  imports: [
    AppConfigModule,
    MongoModule,
    QueuesModule,
    NotificationsModule,
    ProvidersModule,
  ],
  providers: [...PROCESSORS],
})
export class WorkerModule {}

import { Processor } from '@nestjs/bullmq';
import { CHANNEL_QUEUES } from '../../channels/channels.constants.js';
import { ChannelProcessor } from './channel.processor.js';

/**
 * Listens on the email queue. All the logic lives in ChannelProcessor;
 * concurrency comes from EMAIL_WORKER_CONCURRENCY.
 */
@Processor(CHANNEL_QUEUES.email)
export class EmailProcessor extends ChannelProcessor {
  protected readonly channel = 'email' as const;
}

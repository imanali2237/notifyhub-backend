import { Processor } from '@nestjs/bullmq';
import { CHANNEL_QUEUES } from '../../channels/channels.constants.js';
import { ChannelProcessor } from './channel.processor.js';

/**
 * Listens on the in-app queue. All the logic lives in ChannelProcessor;
 * concurrency comes from IN_APP_WORKER_CONCURRENCY.
 */
@Processor(CHANNEL_QUEUES.in_app)
export class InAppProcessor extends ChannelProcessor {
  protected readonly channel = 'in_app' as const;
}

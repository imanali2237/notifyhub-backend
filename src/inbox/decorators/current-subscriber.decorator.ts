import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type {
  SubscriberContext,
  SubscriberRequest,
} from '../inbox.interfaces.js';

/** In a SubscriberAuthGuard route: `list(@CurrentSubscriber() sub: SubscriberContext)` */
export const CurrentSubscriber = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SubscriberContext | undefined =>
    context.switchToHttp().getRequest<SubscriberRequest>().subscriber,
);

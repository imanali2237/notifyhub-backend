import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BEARER_PREFIX } from '../../auth/auth.constants.js';
import { InboxTokenService } from '../inbox-token.service.js';
import type { SubscriberRequest } from '../inbox.interfaces.js';

/**
 * Protects the inbox routes the BROWSER calls: @UseGuards(SubscriberAuthGuard)
 * Expects `Authorization: Bearer <subscriber token>` (from POST /v1/inbox/tokens).
 */
@Injectable()
export class SubscriberAuthGuard implements CanActivate {
  constructor(private readonly tokens: InboxTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SubscriberRequest>();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== BEARER_PREFIX || !token) {
      throw new UnauthorizedException(
        'Missing Authorization: Bearer <subscriber token> header',
      );
    }
    try {
      req.subscriber = (await this.tokens.verify(token)).subscriber;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired subscriber token');
    }
  }
}

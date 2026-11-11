import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { InboxTokenService } from './inbox-token.service.js';
import { InboxTokensController } from './inbox-tokens.controller.js';
import { InboxController } from './inbox.controller.js';
import { InboxGateway } from './inbox.gateway.js';
import { InboxModule } from './inbox.module.js';
import { SubscriberAuthGuard } from './guards/subscriber-auth.guard.js';

/**
 * The in-app inbox as seen from outside (API process only):
 *  - POST /v1/inbox/tokens       your backend gets a token for one subscriber
 *  - GET/POST /v1/inbox/...      the browser lists messages and marks them read
 *  - WebSocket namespace /inbox  the browser receives new messages live
 */
@Module({
  imports: [
    InboxModule,
    ApiKeysModule,
    // No default secret: InboxTokenService signs with its own derived key.
    JwtModule.register({}),
  ],
  controllers: [InboxTokensController, InboxController],
  providers: [InboxTokenService, SubscriberAuthGuard, InboxGateway],
})
export class InboxApiModule {}

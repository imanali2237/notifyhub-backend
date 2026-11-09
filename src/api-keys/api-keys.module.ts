import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';

@Module({
  imports: [AuthModule], // for JwtAuthGuard (dashboard routes)
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard],
  // Exported so the events/trigger module can protect its routes with it.
  exports: [ApiKeyGuard],
})
export class ApiKeysModule {}

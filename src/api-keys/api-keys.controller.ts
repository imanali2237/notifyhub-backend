import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.interfaces.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { ApiKeyContext } from './api-keys.interfaces.js';
import { CurrentTenant } from './decorators/current-tenant.decorator.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';

@Controller('v1/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  // ── Dashboard routes: logged-in user (JWT) manages their tenant's keys ──

  /** POST /v1/api-keys → { name, environment? } → returns the full key ONCE */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(user.tenantId, dto);
  }

  /** GET /v1/api-keys → all keys of my tenant (prefix only) */
  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.apiKeys.list(user.tenantId);
  }

  /** DELETE /v1/api-keys/:id → revoke */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeys.revoke(user.tenantId, id);
  }

  // ── SDK route: authenticated by the API key itself ──

  /**
   * GET /v1/api-keys/current (header: x-api-key)
   * Lets an SDK/app check "is my key valid, and which tenant is it for?"
   */
  @Get('current')
  @UseGuards(ApiKeyGuard)
  current(@CurrentTenant() ctx: ApiKeyContext) {
    return ctx;
  }
}

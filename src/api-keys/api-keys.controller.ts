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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.interfaces.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MessageResponseDto } from '../common/dto/message-response.dto.js';
import { ApiErrorResponses } from '../common/swagger/api-error-responses.decorator.js';
import {
  API_KEY_SECURITY,
  API_TAGS,
  JWT_SECURITY,
} from '../common/swagger/swagger.constants.js';
import type { ApiKeyContext } from './api-keys.interfaces.js';
import { ApiKeysService } from './api-keys.service.js';
import { CurrentTenant } from './decorators/current-tenant.decorator.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import {
  ApiKeyContextResponseDto,
  ApiKeyResponseDto,
  CreatedApiKeyResponseDto,
} from './dto/responses/api-key.response.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

@ApiTags(API_TAGS.apiKeys)
@Controller('v1/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  // ── Dashboard routes: logged-in user (JWT) manages their tenant's keys ──

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(JWT_SECURITY)
  @ApiOperation({
    summary: 'Create an API key',
    description:
      'The full key is returned **only in this response**. Only its SHA-256 hash is stored, so it can never be shown again. Max API_KEYS_MAX_ACTIVE_PER_TENANT (default 20) active keys.',
  })
  @ApiCreatedResponse({ type: CreatedApiKeyResponseDto })
  @ApiErrorResponses({
    400: 'Invalid body, or too many active keys',
    401: 'Missing, invalid or expired token',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(user.tenantId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(JWT_SECURITY)
  @ApiOperation({
    summary: "List your tenant's API keys",
    description: 'Shows prefixes only — never the full keys. Newest first.',
  })
  @ApiOkResponse({ type: [ApiKeyResponseDto] })
  @ApiErrorResponses({ 401: 'Missing, invalid or expired token' })
  list(@CurrentUser() user: AuthUser) {
    return this.apiKeys.list(user.tenantId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(JWT_SECURITY)
  @ApiOperation({
    summary: 'Revoke an API key',
    description:
      'The key stops working immediately. The record is kept for audit.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'API key id' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponses({
    400: 'id is not a UUID',
    401: 'Missing, invalid or expired token',
    404: 'Not found, already revoked, or belongs to another tenant',
  })
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeys.revoke(user.tenantId, id);
  }

  // ── SDK route: authenticated by the API key itself ──

  @Get('current')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity(API_KEY_SECURITY)
  @ApiOperation({
    summary: 'Check an API key',
    description: 'Is my key valid, and which tenant and environment is it for?',
  })
  @ApiOkResponse({ type: ApiKeyContextResponseDto })
  @ApiErrorResponses({ 401: 'Missing, invalid or revoked API key' })
  current(@CurrentTenant() ctx: ApiKeyContext) {
    return ctx;
  }
}

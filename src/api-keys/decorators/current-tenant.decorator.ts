import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ApiKeyContext, ApiKeyRequest } from '../api-keys.interfaces.js';

/** In an ApiKeyGuard route: `trigger(@CurrentTenant() ctx: ApiKeyContext)` */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiKeyContext | undefined =>
    context.switchToHttp().getRequest<ApiKeyRequest>().apiKey,
);

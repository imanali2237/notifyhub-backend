import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  API_KEY_BRAND_PREFIX,
  API_KEY_HEADER,
  LAST_USED_UPDATE_INTERVAL_MS,
} from '../api-keys.constants.js';
import type { ApiKeyRequest } from '../api-keys.interfaces.js';
import { hashApiKey } from '../utils/api-key.util.js';

/**
 * Protects routes the SDK calls (e.g. POST /v1/events/trigger): @UseGuards(ApiKeyGuard)
 *
 * Reads `x-api-key`, hashes it, and looks the hash up. The tenant comes from the
 * key's row in the database — the caller can't choose it.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ApiKeyRequest>();
    const key = req.headers[API_KEY_HEADER];

    if (typeof key !== 'string' || !key.startsWith(API_KEY_BRAND_PREFIX)) {
      throw new UnauthorizedException(
        `Missing or malformed ${API_KEY_HEADER} header`,
      );
    }

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(key) },
      include: { tenant: { select: { name: true } } },
    });

    // Same message for unknown and revoked keys — don't tell attackers which one it is.
    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    this.touchLastUsed(apiKey.id, apiKey.lastUsedAt);

    req.apiKey = {
      tenantId: apiKey.tenantId,
      tenantName: apiKey.tenant.name,
      apiKeyId: apiKey.id,
      environment: apiKey.environment,
    };
    return true;
  }

  /**
   * Fire-and-forget, at most once per interval: the request shouldn't wait for
   * (or fail because of) this write, and busy keys shouldn't write on every call.
   */
  private touchLastUsed(id: string, lastUsedAt: Date | null): void {
    const now = Date.now();
    if (
      lastUsedAt &&
      now - lastUsedAt.getTime() <= LAST_USED_UPDATE_INTERVAL_MS
    ) {
      return;
    }
    this.prisma.apiKey
      .update({ where: { id }, data: { lastUsedAt: new Date(now) } })
      .catch((err: Error) =>
        this.logger.warn(`Could not update lastUsedAt: ${err.message}`),
      );
  }
}

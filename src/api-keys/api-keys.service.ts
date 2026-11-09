import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  API_KEY_PUBLIC_SELECT,
  MAX_ACTIVE_KEYS_PER_TENANT,
} from './api-keys.constants.js';
import { generateApiKey } from './utils/api-key.util.js';
import type { CreateApiKeyDto } from './dto/create-api-key.dto.js';

/**
 * Every method takes tenantId from the caller's JWT (never from the request body),
 * and every query filters by it. That's what stops tenant A from listing or
 * revoking tenant B's keys.
 */
@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateApiKeyDto) {
    const active = await this.prisma.apiKey.count({
      where: { tenantId, revokedAt: null },
    });
    if (active >= MAX_ACTIVE_KEYS_PER_TENANT) {
      throw new BadRequestException(
        `You can have at most ${MAX_ACTIVE_KEYS_PER_TENANT} active API keys. Revoke one first.`,
      );
    }

    const environment = dto.environment ?? 'live';
    const { key, prefix, hash } = generateApiKey(environment);

    const apiKey = await this.prisma.apiKey.create({
      data: { tenantId, name: dto.name, environment, prefix, keyHash: hash },
      select: API_KEY_PUBLIC_SELECT,
    });

    return {
      ...apiKey,
      key, // the only time the full key ever leaves the server
      warning: 'Copy this key now. You will not be able to see it again.',
    };
  }

  list(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: API_KEY_PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Soft delete: we set revokedAt instead of deleting the row, so the dashboard
   * can still show "revoked on <date>" and logs can still say which key was used.
   */
  async revoke(tenantId: string, id: string) {
    // `tenantId` in the WHERE: another tenant's key id simply "doesn't exist" here.
    const { count } = await this.prisma.apiKey.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('API key not found or already revoked');
    }
    return { message: 'API key revoked. It stops working immediately.' };
  }
}

import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Connection } from 'mongoose';
import { Redis } from 'ioredis';
import { withTimeout } from '../common/utils/with-timeout.js';
import { API_TAGS } from '../common/swagger/swagger.constants.js';
import type { Env } from '../config/env.js';
import { HealthResponseDto } from './dto/health.response.js';
import { PrismaService } from '../database/prisma.service.js';
import { REDIS } from '../redis/redis.constants.js';
import type { HealthReport, ServiceStatus } from './health.interfaces.js';

/** GET /health — pings every backing service. 200 if all are up, 503 otherwise. */
@ApiTags(API_TAGS.health)
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Check the server and its dependencies',
    description:
      'Pings PostgreSQL, MongoDB and Redis (each gets HEALTH_PROBE_TIMEOUT_MS, default 2s). No auth needed — for load balancers and uptime monitors.',
  })
  @ApiOkResponse({ type: HealthResponseDto, description: 'Everything is up' })
  @ApiServiceUnavailableResponse({
    type: HealthResponseDto,
    description: 'At least one dependency is down (see `services`)',
  })
  async check(): Promise<HealthReport> {
    const [postgres, mongo, redis] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(() => this.mongo.db!.admin().ping()),
      this.probe(() => this.redis.ping()),
    ]);
    const services = { postgres, mongo, redis };
    const ok = Object.values(services).every((s) => s === 'up');

    if (!ok) {
      throw new ServiceUnavailableException({ status: 'error', services });
    }
    return { status: 'ok', services };
  }

  /**
   * Without the timeout a dead service can hang the request forever
   * (e.g. ioredis queues commands while it waits to reconnect).
   */
  private async probe(fn: () => Promise<unknown>): Promise<ServiceStatus> {
    try {
      await withTimeout(fn(), this.config.get('HEALTH_PROBE_TIMEOUT_MS'));
      return 'up';
    } catch {
      return 'down';
    }
  }
}

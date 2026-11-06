import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { Redis } from 'ioredis';
import { PrismaService } from '../database/prisma.service.js';
import { REDIS } from '../redis/redis.module.js';

type Status = 'up' | 'down';

/** GET /health — pings every backing service. 200 if all are up, 503 otherwise. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const [postgres, mongo, redis] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(() => this.mongo.db!.admin().ping()),
      this.probe(() => this.redis.ping()),
    ]);
    const services = { postgres, mongo, redis };
    const ok = Object.values(services).every((s) => s === 'up');

    if (!ok)
      throw new ServiceUnavailableException({ status: 'error', services });
    return { status: 'ok', services };
  }

  /**
   * Runs one ping with a timeout. Without the timeout a dead service can hang the
   * request forever (e.g. ioredis queues commands while it waits to reconnect).
   */
  private async probe(
    fn: () => Promise<unknown>,
    timeoutMs = 2000,
  ): Promise<Status> {
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs).unref(),
        ),
      ]);
      return 'up';
    } catch {
      return 'down';
    }
  }
}

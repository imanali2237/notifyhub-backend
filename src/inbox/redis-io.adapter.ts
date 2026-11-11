import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import type { Env } from '../config/env.js';
import { corsOrigin } from '../common/http/cors.js';

/**
 * Socket.IO with the Redis adapter. Two jobs:
 *  1. Messages published by ANY process (the worker's InboxRealtimeService)
 *     reach the sockets connected to THIS API process.
 *  2. With several API instances, a message reaches the subscriber whichever
 *     instance their browser is connected to.
 *
 * It needs its own two Redis connections: one publishes, one stays in
 * "subscribe" mode (a subscribed connection can't run other commands).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly config: ConfigService<Env, true>;
  private pub?: Redis;
  private sub?: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
    this.config = app.get<ConfigService<Env, true>>(ConfigService);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: corsOrigin(this.config.get('CORS_ORIGINS')) },
    } as ServerOptions) as Server;

    if (!this.pub || !this.sub) {
      this.pub = new Redis({
        host: this.config.get('REDIS_HOST'),
        port: this.config.get('REDIS_PORT'),
        password: this.config.get('REDIS_PASSWORD', { infer: true }),
      });
      this.sub = this.pub.duplicate();
    }
    server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.allSettled([this.pub?.quit(), this.sub?.quit()]);
  }
}

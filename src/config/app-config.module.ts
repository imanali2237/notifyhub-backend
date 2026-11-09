import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.js';

/**
 * Loads .env, validates it with zod, and makes ConfigService available everywhere.
 * Shared by both processes: the API (main.ts) and the worker (worker.ts).
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
})
export class AppConfigModule {}

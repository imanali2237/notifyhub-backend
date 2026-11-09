import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module.js';

/**
 * Entry point of the WORKER process (the API's is main.ts).
 * Same codebase, separate process: run `npm run start:worker`.
 * You can run several workers to send faster, without touching the API.
 */
async function bootstrap() {
  // No HTTP server — just the DI container, so the queue processors start.
  const app = await NestFactory.createApplicationContext(WorkerModule);

  // On Ctrl+C / SIGTERM: stop taking new jobs, finish in-flight ones, then exit.
  app.enableShutdownHooks();

  Logger.log('Worker started, waiting for jobs…', 'Worker');
}
await bootstrap();

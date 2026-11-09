import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './common/swagger/swagger.setup.js';
import type { Env } from './config/env.js';
import { setupBullBoard } from './queues/bull-board.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Validates every @Body() against its DTO class (class-validator decorators).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties that aren't in the DTO
      forbidNonWhitelisted: true, // ...and reject the request if any were sent
      transform: true, // turn the JSON into a real DTO instance (runs @Transform)
    }),
  );

  // Lets onModuleDestroy / onApplicationShutdown run on Ctrl+C / SIGTERM.
  app.enableShutdownHooks();

  const port = config.get('PORT');
  if (config.get('SWAGGER_ENABLED')) {
    const path = config.get('SWAGGER_PATH');
    setupSwagger(app, path);
    Logger.log(`API docs: http://localhost:${port}/${path}`, 'Swagger');
  }

  // Queue dashboard (Bull Board) — see BULL_BOARD_* in .env.
  setupBullBoard(app);

  await app.listen(port);
}
await bootstrap();

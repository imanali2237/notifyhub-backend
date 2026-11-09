import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { CHANNEL_QUEUES, CHANNELS } from '../channels/channels.constants.js';
import { basicAuth } from '../common/http/basic-auth.middleware.js';
import type { Env } from '../config/env.js';

const logger = new Logger('BullBoard');

/**
 * Mounts the Bull Board queue dashboard on the API (default /queues).
 * Every channel queue shows up automatically (built from CHANNELS).
 *
 * Security — the dashboard can retry and delete jobs, so:
 *  - BULL_BOARD_PASSWORD set     → browser login (username + password)
 *  - not set, development        → open, with a warning in the logs
 *  - not set, any other NODE_ENV → not mounted at all
 */
export function setupBullBoard(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  if (!config.get('BULL_BOARD_ENABLED')) return;

  const path = `/${config.get('BULL_BOARD_PATH')}`;
  const password = config.get('BULL_BOARD_PASSWORD', { infer: true });
  const isDev = config.get('NODE_ENV') === 'development';

  if (!password && !isDev) {
    logger.warn(
      'Queue dashboard disabled: set BULL_BOARD_PASSWORD to enable it outside development',
    );
    return;
  }

  const readOnlyMode = config.get('BULL_BOARD_READ_ONLY');
  const serverAdapter = new ExpressAdapter().setBasePath(path);
  createBullBoard({
    queues: CHANNELS.map(
      (channel) =>
        new BullMQAdapter(
          app.get<Queue>(getQueueToken(CHANNEL_QUEUES[channel])),
          {
            readOnlyMode,
            displayName: `${channel} (${CHANNEL_QUEUES[channel]})`,
          },
        ),
    ),
    serverAdapter,
    options: { uiConfig: { boardTitle: 'NotifyHub' } },
  });

  const router = serverAdapter.getRouter() as Parameters<
    INestApplication['use']
  >[0];
  if (password) {
    app.use(
      path,
      basicAuth(
        config.get('BULL_BOARD_USERNAME'),
        password,
        'NotifyHub queues',
      ),
      router,
    );
  } else {
    logger.warn('Queue dashboard has NO password (set BULL_BOARD_PASSWORD)');
    app.use(path, router);
  }

  logger.log(
    `Queue dashboard: http://localhost:${config.get('PORT')}${path}${readOnlyMode ? ' (read-only)' : ''}`,
  );
}

import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { API_KEY_HEADER } from '../../api-keys/api-keys.constants.js';
import {
  API_KEY_SECURITY,
  API_TAGS,
  JWT_SECURITY,
  SUBSCRIBER_SECURITY,
} from './swagger.constants.js';

const DESCRIPTION = `
Plug-and-play notification platform. Your backend triggers an event once;
NotifyHub queues it, renders templates, sends it on each channel, retries
failures and logs every status change.

### Three ways to authenticate
| Who | How | Used for |
|---|---|---|
| **A person** using the dashboard | \`Authorization: Bearer <accessToken>\` from \`POST /v1/auth/login\` | Managing API keys (and later templates, providers…) |
| **Your app's backend** / the SDK | \`${API_KEY_HEADER}: nh_live_…\` from \`POST /v1/api-keys\` | Sending notifications, reading their status, creating subscriber tokens |
| **Your user's browser** (inbox UI) | \`Authorization: Bearer <token>\` from \`POST /v1/inbox/tokens\` | Reading their own in-app inbox |

Click **Authorize** to set one for the "Try it out" buttons.

### Quick start
1. \`POST /v1/auth/signup\` → \`POST /v1/auth/login\` → copy \`accessToken\`
2. Authorize as **jwt**, then \`POST /v1/api-keys\` → copy \`key\` (shown once!)
3. Authorize as **api-key**, then \`POST /v1/events/trigger\`
4. \`GET /v1/notifications/{id}\` to watch it go \`queued → processing → sent\`
`;

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('NotifyHub API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Dashboard login token from POST /v1/auth/login',
      },
      JWT_SECURITY,
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: API_KEY_HEADER,
        description: 'API key from POST /v1/api-keys (nh_live_… or nh_test_…)',
      },
      API_KEY_SECURITY,
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Subscriber token from POST /v1/inbox/tokens (one user’s inbox)',
      },
      SUBSCRIBER_SECURITY,
    )
    .addTag(API_TAGS.health, 'Is the server and every dependency up?')
    .addTag(
      API_TAGS.auth,
      'Dashboard accounts: signup, email verification, login',
    )
    .addTag(API_TAGS.apiKeys, 'Create, list and revoke the keys your apps use')
    .addTag(API_TAGS.events, 'Trigger notifications (what the SDK calls)')
    .addTag(API_TAGS.email, 'Send an email')
    .addTag(API_TAGS.inApp, 'Send a message to a user’s in-app inbox')
    .addTag(
      API_TAGS.inbox,
      'The in-app inbox your users see (live over the /inbox WebSocket)',
    )
    .addTag(API_TAGS.notifications, 'Status and history of sent notifications')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Serves Swagger UI at /{path} and the raw OpenAPI JSON at /{path}-json. */
export function setupSwagger(app: INestApplication, path: string): void {
  SwaggerModule.setup(path, app, buildSwaggerDocument(app), {
    customSiteTitle: 'NotifyHub API docs',
    swaggerOptions: {
      persistAuthorization: true, // keep tokens after a page refresh
      tagsSorter: 'alpha',
      displayRequestDuration: true,
    },
  });
}

import type { Request } from 'express';
import type { ApiKeyEnvironment } from '../generated/prisma/client.js';

/** The caller of an SDK route, as controllers receive it via @CurrentTenant(). */
export interface ApiKeyContext {
  tenantId: string;
  tenantName: string;
  apiKeyId: string;
  environment: ApiKeyEnvironment;
}

/** An Express request after ApiKeyGuard has run. */
export type ApiKeyRequest = Request & { apiKey?: ApiKeyContext };

/** Result of generating a key: the full key goes to the user, the rest to the DB. */
export interface GeneratedApiKey {
  key: string; // shown to the user ONCE, never stored
  prefix: string; // stored, safe to display
  hash: string; // stored, used for lookup
}

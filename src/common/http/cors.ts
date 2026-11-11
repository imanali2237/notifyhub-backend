/**
 * CORS_ORIGINS (already parsed into a list) → the `origin` option of
 * Express CORS and Socket.IO: true = any website, or the allowed list.
 */
export function corsOrigin(origins: string[]): true | string[] {
  return origins.includes('*') ? true : origins;
}

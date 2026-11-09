import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Hash first, so both sides have equal length for timingSafeEqual. */
const digest = (value: string) => createHash('sha256').update(value).digest();

const safeEqual = (a: string, b: string) =>
  timingSafeEqual(digest(a), digest(b));

/**
 * HTTP Basic auth: the browser shows its built-in login prompt and then sends
 * `Authorization: Basic base64(username:password)` with every request.
 * Used for browser pages that can't send a JWT header (e.g. the queue dashboard).
 * Only safe over HTTPS in production — Basic auth is encoded, not encrypted.
 */
export function basicAuth(username: string, password: string, realm: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);
      // Check both (no short-circuit), so timing doesn't reveal which one was wrong.
      const userOk = safeEqual(user, username);
      const passOk = safeEqual(pass, password);
      if (separator !== -1 && userOk && passOk) return next();
    }
    res
      .status(401)
      .set('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`)
      .send('Authentication required');
  };
}

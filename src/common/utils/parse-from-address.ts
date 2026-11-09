export interface FromAddress {
  name?: string;
  email: string;
}

const WITH_NAME = /^\s*"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>\s*$/;
const EMAIL_ONLY = /^\s*([^<>\s]+@[^<>\s]+)\s*$/;

/**
 * Parses a sender written the usual way in .env:
 *   "NotifyHub <no-reply@example.com>"  → { name: 'NotifyHub', email: 'no-reply@example.com' }
 *   "no-reply@example.com"              → { email: 'no-reply@example.com' }
 * Returns null if it's neither.
 */
export function parseFromAddress(value: string): FromAddress | null {
  const withName = WITH_NAME.exec(value);
  if (withName) {
    const name = withName[1].trim();
    return name ? { name, email: withName[2] } : { email: withName[2] };
  }
  const emailOnly = EMAIL_ONLY.exec(value);
  return emailOnly ? { email: emailOnly[1] } : null;
}

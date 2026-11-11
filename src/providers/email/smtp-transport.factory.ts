import type { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';

/**
 * The nodemailer transport for SmtpEmailProvider, built from SMTP_* in .env.
 *
 * With SMTP_POOL=true (default) it keeps up to SMTP_MAX_CONNECTIONS connections
 * open and reuses them. Without a pool, every email pays for a new TCP (+ TLS)
 * connection and login — the main bottleneck when sending many emails.
 */
export function createSmtpTransport(
  config: ConfigService<Env, true>,
): Transporter {
  const user = config.get('SMTP_USER', { infer: true });
  const pass = config.get('SMTP_PASS', { infer: true });

  const pool = config.get('SMTP_POOL')
    ? {
        pool: true as const,
        maxConnections: config.get('SMTP_MAX_CONNECTIONS'),
        maxMessages: config.get('SMTP_MAX_MESSAGES'),
      }
    : {};

  return nodemailer.createTransport({
    ...pool,
    host: config.get('SMTP_HOST', { infer: true }),
    port: config.get('SMTP_PORT', { infer: true }),
    secure: config.get('SMTP_SECURE'), // true = implicit TLS (port 465)
    auth: user ? { user, pass } : undefined, // Mailpit needs no auth
    // Don't let a hanging SMTP server block a request or worker slot forever.
    connectionTimeout: config.get('SMTP_CONNECTION_TIMEOUT_MS'),
    socketTimeout: config.get('SMTP_SOCKET_TIMEOUT_MS'),
  });
}

import type { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';

/** The nodemailer transport for SmtpEmailProvider, built from SMTP_* in .env. */
export function createSmtpTransport(
  config: ConfigService<Env, true>,
): Transporter {
  const user = config.get('SMTP_USER', { infer: true });
  const pass = config.get('SMTP_PASS', { infer: true });

  return nodemailer.createTransport({
    host: config.get('SMTP_HOST', { infer: true }),
    port: config.get('SMTP_PORT', { infer: true }),
    secure: config.get('SMTP_SECURE'), // true = implicit TLS (port 465)
    auth: user ? { user, pass } : undefined, // Mailpit needs no auth
    // Don't let a hanging SMTP server block a request or worker slot forever.
    connectionTimeout: config.get('SMTP_CONNECTION_TIMEOUT_MS'),
    socketTimeout: config.get('SMTP_SOCKET_TIMEOUT_MS'),
  });
}

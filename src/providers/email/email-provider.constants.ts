/**
 * Built-in email providers the operator can list in EMAIL_PROVIDERS.
 * Adding one: put its id here, write the class, add it to providers.catalog.ts
 * and its required settings to EMAIL_PROVIDER_REQUIRED_SETTINGS.
 */
export const EMAIL_PROVIDER_IDS = ['smtp', 'brevo'] as const;
export type EmailProviderId = (typeof EMAIL_PROVIDER_IDS)[number];

/** Settings that must be set in .env when a provider is listed in EMAIL_PROVIDERS. */
export const EMAIL_PROVIDER_REQUIRED_SETTINGS = {
  smtp: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'],
  brevo: ['BREVO_API_KEY', 'BREVO_FROM'],
} as const satisfies Record<EmailProviderId, readonly string[]>;

// ── SMTP ──

/** nodemailer error codes for a malformed sender/recipient → the message is the problem. */
export const SMTP_MESSAGE_ERROR_CODES = ['EENVELOPE'];
/** nodemailer error code when login to the SMTP server fails → this provider is misconfigured. */
export const SMTP_AUTH_ERROR_CODE = 'EAUTH';
/** SMTP replies about authentication (530, 534, 535) → this provider is misconfigured. */
export const SMTP_AUTH_RESPONSE_CODES = [530, 534, 535];
/** SMTP 5xx replies that are about the recipient mailbox (550, 551, 553). */
export const SMTP_MAILBOX_RESPONSE_CODES = [550, 551, 553];
/**
 * Enhanced status code subjects (RFC 3463, the "5.1.1" in a reply) that mean the
 * MESSAGE is the problem: 1 = bad address, 2 = mailbox, 6 = content.
 * Anything else (e.g. 5.4.5 "daily sending quota exceeded", 5.7.x policy) is the
 * PROVIDER's problem — another provider may still deliver it.
 */
export const SMTP_MESSAGE_STATUS_SUBJECTS = [1, 2, 6];

// ── Brevo ──

/** https://developers.brevo.com/reference/sendtransacemail */
export const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

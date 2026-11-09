import type { OtpPurpose } from '../otp/otp.interfaces.js';

/** OTP purpose used for signup email verification. */
export const EMAIL_VERIFICATION_OTP_PURPOSE: OtpPurpose = 'verify-email';

/**
 * A password nobody has. On login with an unknown email we still run argon2.verify
 * against its hash, so the response takes as long as a wrong password would —
 * otherwise response time would reveal which emails are registered.
 */
export const TIMING_SAFE_DUMMY_PASSWORD = 'no-user-has-this-password';

/** Header the dashboard sends the JWT in: `Authorization: Bearer <token>` */
export const BEARER_PREFIX = 'Bearer';

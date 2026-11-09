/** How long a code stays valid. */
export const OTP_TTL_SECONDS = 15 * 60;

/** Wrong guesses allowed before the code is destroyed. */
export const OTP_MAX_ATTEMPTS = 5;

/** Minimum gap between two codes for the same purpose + identifier. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Number of digits in a code (6 → 000000–999999). */
export const OTP_LENGTH = 6;

/** Redis key prefix → otp:{purpose}:{id} and otp:{purpose}:{id}:cooldown */
export const OTP_KEY_PREFIX = 'otp';

/** Number of digits in a code (6 → 000000–999999). */
export const OTP_LENGTH = 6;

/** Redis key prefix → otp:{purpose}:{id} and otp:{purpose}:{id}:cooldown */
export const OTP_KEY_PREFIX = 'otp';

// TTL, max attempts and resend cooldown are configurable: OTP_* in .env
// (defaults in config/config.defaults.ts).

/** What the OTP is for. Each purpose gets its own Redis keys, so codes can't be mixed up. */
export type OtpPurpose = 'verify-email';

/** Result of checking a code. */
export type OtpCheck = 'valid' | 'invalid' | 'expired' | 'too_many_attempts';

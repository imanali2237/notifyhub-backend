/** Redis key: idem:{tenantId}:{idempotencyKey} → transactionId */
export const IDEMPOTENCY_KEY_PREFIX = 'idem';

/** Event names look like "order-shipped", "user.signup", "password_reset". */
export const EVENT_NAME_PATTERN = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;

/** MongoDB duplicate key error code (unique index violation). */
export const MONGO_DUPLICATE_KEY_ERROR = 11000;

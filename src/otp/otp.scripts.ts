/**
 * Lua scripts run atomically inside Redis (no other command can run in between).
 *
 * CHECK_OTP: if the OTP exists, count this attempt and return [attempts, hash];
 * return nil if it doesn't exist. Atomic so two parallel guesses can't both read
 * "attempts = 4", and so we never re-create a key that expired between commands.
 */
export const CHECK_OTP_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return nil end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return { attempts, redis.call('HGET', KEYS[1], 'hash') }
`;

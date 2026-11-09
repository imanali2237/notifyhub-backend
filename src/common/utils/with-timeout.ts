/**
 * Rejects if `promise` doesn't settle within `ms`.
 * Use it around calls to outside services, so a dead dependency can't hang a request.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      // unref(): this timer alone won't keep the Node process alive
      setTimeout(
        () => reject(new Error(`Timed out after ${ms}ms`)),
        ms,
      ).unref(),
    ),
  ]);
}

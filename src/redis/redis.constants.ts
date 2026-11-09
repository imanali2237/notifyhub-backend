/** Injection token for the shared ioredis client: `@Inject(REDIS) private redis: Redis` */
export const REDIS = Symbol('REDIS');

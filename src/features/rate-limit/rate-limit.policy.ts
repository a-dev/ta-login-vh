import { ApiError, type ErrorCode } from '@/shared/api-error.js';
import type { RedisCounter } from '@/platform/redis/client.js';

// limits
export const RATE_LIMIT_WINDOW_SECONDS = 600;
export const IP_FAILURE_LIMIT = 3;
export const EMAIL_FAILURE_LIMIT = 3;

// Failed types
export const COUNTS_AS_FAILED_ATTEMPT: ReadonlySet<ErrorCode> = new Set([
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'DISPOSABLE_EMAIL_NOT_ALLOWED',
]);

// Rate limit store interface
export type RateLimitStore = {
  incrementIp(ip: string, windowSeconds: number): Promise<number>;
  incrementEmail(email: string, windowSeconds: number): Promise<number>;
  readIp(ip: string): Promise<RedisCounter | null>;
  readEmail(email: string): Promise<RedisCounter | null>;
};

// return the remaining TTL if the counter over its limit, otherwise undefined
function retryAfterSecondsIfLimited(counter: RedisCounter | null, limit: number) {
  return counter !== null && counter.count >= limit ? counter.ttlSeconds : undefined;
}

export type RateLimitPolicy = {
  assertAllowed(ip: string, normalizedEmail?: string): Promise<void>;
  recordClientFailure(ip: string, normalizedEmail?: string): Promise<void>;
};

export function createRateLimitPolicy(store: RateLimitStore): RateLimitPolicy {
  return {
    async assertAllowed(ip, normalizedEmail) {
      let ipCounter: RedisCounter | null;
      let emailCounter: RedisCounter | null;
      try {
        // both windows in parallel
        [ipCounter, emailCounter] = await Promise.all([
          store.readIp(ip),
          normalizedEmail === undefined ? Promise.resolve(null) : store.readEmail(normalizedEmail),
        ]);
      } catch (error) {
        throw new ApiError('SERVICE_UNAVAILABLE', { cause: error });
      }

      const retryAfter = Math.max(
        retryAfterSecondsIfLimited(ipCounter, IP_FAILURE_LIMIT) ?? 0,
        retryAfterSecondsIfLimited(emailCounter, EMAIL_FAILURE_LIMIT) ?? 0,
      );

      if (retryAfter > 0) throw new RateLimitExceededError(retryAfter);
    },

    async recordClientFailure(ip, normalizedEmail) {
      try {
        await Promise.all([
          store.incrementIp(ip, RATE_LIMIT_WINDOW_SECONDS),
          normalizedEmail === undefined
            ? Promise.resolve()
            : store.incrementEmail(normalizedEmail, RATE_LIMIT_WINDOW_SECONDS),
        ]);
      } catch (error) {
        // it throws often in dev (?)
        throw new ApiError('SERVICE_UNAVAILABLE', { cause: error });
      }
    },
  };
}

export class RateLimitExceededError extends ApiError {
  // 429 with the `Retry-After` header
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super('RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

import type { RedisClient } from '@/platform/redis/client.js';
import { emailRateLimitKey, sessionKey } from '@/platform/redis/keys.js';

import { SESSION_TTL_SECONDS } from '../login.policy.js';
import type { SessionStore } from '../ports.js';

export function createRedisSessionStore(client: RedisClient): SessionStore {
  return {
    async persistLoginSuccess(jti, userId, email, createdAt = new Date()) {
      await client.createSessionAndClearFailureCounter(
        sessionKey(jti),
        { userId, createdAt: createdAt.toISOString() },
        emailRateLimitKey(email),
        SESSION_TTL_SECONDS,
      );
    },
  };
}

import type { RateLimitStore } from '../rate-limit.policy.js';

import type { RedisClient } from '@/platform/redis/client.js';
import { emailRateLimitKey, ipRateLimitKey } from '@/platform/redis/keys.js';

export function createRedisRateLimitStore(client: RedisClient): RateLimitStore {
  return {
    incrementIp: (ip, windowSeconds) =>
      client.incrementFixedWindow(ipRateLimitKey(ip), windowSeconds),
    incrementEmail: (email, windowSeconds) =>
      client.incrementFixedWindow(emailRateLimitKey(email), windowSeconds),
    readIp: (ip) => client.readFixedWindow(ipRateLimitKey(ip)),
    readEmail: (email) => client.readFixedWindow(emailRateLimitKey(email)),
  };
}

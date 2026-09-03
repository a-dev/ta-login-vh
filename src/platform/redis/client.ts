import { createClient } from 'redis';

import type { AppConfig } from '@/config/env.js';
import { describeError, log } from '@/shared/logger.js';

export type RedisCounter = {
  count: number; // failures
  ttlSeconds: number; // seconds remain in the current window
};

export type RedisSession = {
  userId: string;
  createdAt: string;
};

export type RedisClient = {
  incrementFixedWindow(key: string, windowSeconds: number): Promise<number>;
  readFixedWindow(key: string): Promise<RedisCounter | null>;
  delete(key: string): Promise<void>;
  createSessionAndClearFailureCounter(
    sessionKey: string,
    session: RedisSession,
    emailFailureCounterKey: string,
    ttlSeconds: number,
  ): Promise<void>;
  disconnect(): Promise<void>;
};

function requirePositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

type QueuedTransaction = { exec(): Promise<unknown> };

async function execTransaction(
  transaction: QueuedTransaction,
  expectedReplies: number,
  description: string,
): Promise<unknown[]> {
  // Do not trust Redis. Verify transaction.
  const replies = await transaction.exec();
  if (
    !Array.isArray(replies) ||
    replies.length !== expectedReplies ||
    replies.some((reply) => reply instanceof Error)
  ) {
    throw new Error(`Redis did not complete the ${description} transaction`);
  }
  return replies;
}

// Shared parser for the count/TTL pair returned by counter transactions
function parseCounter(rawCount: unknown, rawTtl: unknown): RedisCounter | null {
  if (rawCount == null) {
    // -2 if key does not exist
    if (Number(rawTtl) !== -2) {
      throw new Error('Redis counter has inconsistent missing state');
    }
    return null;
  }

  const count = Number(rawCount);
  const ttlSeconds = Number(rawTtl);
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds <= 0
  ) {
    throw new Error('Redis counter has an invalid value or expiry');
  }

  return { count, ttlSeconds };
}

export async function createRedisClient(config: AppConfig): Promise<RedisClient> {
  let established = false;
  const client = createClient({
    url: config.REDIS_URL,
    socket: {
      // returns the error before the first successful connection, otherwise retries with exponential backoff
      reconnectStrategy: (retries, cause) =>
        established ? Math.min(2 ** retries * 50, 2000) : cause,
    },
  });

  client.on('error', (error: unknown) => {
    if (established) log.internalFailure('redis.client_error', describeError(error));
  });

  try {
    await client.connect();
    await client.ping();
    established = true;
  } catch (error) {
    if (client.isOpen) {
      client.destroy();
    }
    throw error;
  }

  return {
    async incrementFixedWindow(key, windowSeconds) {
      requirePositiveInteger(windowSeconds, 'windowSeconds');

      const [rawCount, , rawTtl] = await execTransaction(
        // run the commands as a single transaction (multi)
        client.multi().incr(key).expire(key, windowSeconds, 'NX').ttl(key),
        3,
        'counter increment',
      );

      const counter = parseCounter(rawCount, rawTtl);
      if (counter === null) {
        throw new Error('Redis returned an invalid counter increment');
      }
      return counter.count;
    },

    async readFixedWindow(key) {
      const [rawCount, rawTtl] = await execTransaction(
        client.multi().get(key).ttl(key),
        2,
        'counter read',
      );
      return parseCounter(rawCount, rawTtl);
    },

    async delete(key) {
      await client.del(key);
    },

    async createSessionAndClearFailureCounter(
      sessionKey,
      session,
      emailFailureCounterKey,
      ttlSeconds,
    ) {
      requirePositiveInteger(ttlSeconds, 'ttlSeconds');

      const [sessionReply] = await execTransaction(
        client
          .multi()
          .set(sessionKey, JSON.stringify(session), {
            expiration: { type: 'EX', value: ttlSeconds },
          })
          .del(emailFailureCounterKey),
        2,
        'login success',
      );
      if (String(sessionReply) !== 'OK') {
        throw new Error('Redis did not complete the login success transaction');
      }
    },

    async disconnect() {
      if (client.isOpen) await client.close();
    },
  };
}

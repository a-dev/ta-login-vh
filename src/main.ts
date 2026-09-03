import type { Server } from 'node:http';

import { ConfigurationError, loadConfig } from '@/config/env.js';
import { createArgon2PasswordVerifier } from '@/features/login/adapters/argon2-password-verifier.js';
import { createJoseTokenIssuer } from '@/features/login/adapters/jose-token-issuer.js';
import { createMysqlUserRepository } from '@/features/login/adapters/mysql-user-repository.js';
import { createRedisSessionStore } from '@/features/login/adapters/redis-session-store.js';
import { createLoginService } from '@/features/login/login.service.js';
import { createRedisRateLimitStore } from '@/features/rate-limit/adapters/redis-rate-limit-store.js';
import { createRateLimitPolicy } from '@/features/rate-limit/rate-limit.policy.js';
import { createApp } from '@/http/app.js';
import { closeServer, forceCloseConnections, startServer } from '@/http/server.js';
import { createMysqlPool } from '@/platform/mysql.js';
import { createRedisClient } from '@/platform/redis/client.js';
import { describeError, log } from '@/shared/logger.js';

type Resource = {
  readonly name: string;
  readonly close: () => Promise<void>;
};

// close resources in reverse acquisition order
async function releaseResources(resources: readonly Resource[]): Promise<boolean> {
  let clean = true;

  for (const resource of [...resources].reverse()) {
    try {
      await resource.close();
    } catch (error) {
      clean = false;
      log.internalFailure('shutdown.resource_failure', {
        resource: resource.name,
        ...describeError(error),
      });
    }
  }

  return clean;
}

async function main(): Promise<void> {
  const resources: Resource[] = [];

  try {
    const config = loadConfig();

    const mysql = createMysqlPool(config);
    resources.push({ name: 'mysql', close: () => mysql.close() });
    await mysql.checkConnection();

    const redis = await createRedisClient(config);
    resources.push({ name: 'redis', close: () => redis.disconnect() });

    const passwords = await createArgon2PasswordVerifier();

    const login = createLoginService({
      users: createMysqlUserRepository(mysql),
      passwords,
      tokens: createJoseTokenIssuer(config),
      sessions: createRedisSessionStore(redis),
    });

    const app = createApp({
      corsOrigin: config.CORS_ORIGIN,
      trustProxy: config.TRUST_PROXY,
      login,
      rateLimits: createRateLimitPolicy(createRedisRateLimitStore(redis)),
    });

    const server = await startServer(app, config.PORT);
    resources.push({ name: 'http', close: () => closeServer(server) });

    log.startup({ port: config.PORT });

    installLifecycleHandlers(server, resources);
  } catch (error) {
    await releaseResources(resources);
    log.internalFailure(
      error instanceof ConfigurationError ? 'startup.config_invalid' : 'startup.failure',
      describeError(error),
    );
    process.exit(1);
  }
}

// Graceful shutdown
const SHUTDOWN_TIMEOUT_MS = 10_000;

function installLifecycleHandlers(server: Server, resources: readonly Resource[]): void {
  let shuttingDown = false;
  let released = false;

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    log.internalFailure('process.unhandled_rejection', describeError(reason));
    process.exitCode = 1;
    void shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    log.internalFailure('process.uncaught_exception', describeError(error));
    process.exitCode = 1;
    void shutdown('uncaughtException');
  });

  async function shutdown(signal: string): Promise<void> {
    if (released) {
      process.exit(process.exitCode ?? 0);
    }
    if (shuttingDown) {
      log.internalFailure('shutdown.forced', { signal });
      forceCloseConnections(server);
      process.exit(1);
    }
    shuttingDown = true;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), SHUTDOWN_TIMEOUT_MS);
    });

    const outcome = await Promise.race([
      releaseResources(resources).then((clean) => (clean ? 'clean' : 'failed')),
      deadline,
    ]);

    clearTimeout(timer);

    if (outcome === 'timeout') {
      log.internalFailure('shutdown.timeout', { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS });
      forceCloseConnections(server);
      process.exit(1);
    }

    released = true;

    if (outcome === 'failed') {
      log.internalFailure('shutdown.failure', { signal });
      process.exitCode = 1;
      return;
    }

    log.shutdown({ signal });
  }
}

void main();

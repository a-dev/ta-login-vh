import express, { type Express } from 'express';

import { createLoginRouter } from '@/features/login/login.routes.js';
import type { LoginService } from '@/features/login/login.service.js';
import type { RateLimitPolicy } from '@/features/rate-limit/rate-limit.policy.js';

import { jsonBodyMiddleware, malformedJsonMiddleware } from './middleware/body-parser.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorMiddleware } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';

export type HttpDependencies = {
  corsOrigin: string;
  trustProxy: boolean;
  login: LoginService;
  rateLimits: RateLimitPolicy;
};

export function createApp(dependencies: HttpDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', dependencies.trustProxy); // false by default (no proxy for now)

  app.use(requestIdMiddleware());
  app.use(corsMiddleware(dependencies.corsOrigin));
  app.use(jsonBodyMiddleware());
  app.use(malformedJsonMiddleware(dependencies.rateLimits));

  app.use(createLoginRouter({ login: dependencies.login, rateLimits: dependencies.rateLimits }));

  app.use(errorMiddleware());
  return app;
}

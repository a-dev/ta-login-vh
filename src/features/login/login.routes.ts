import { type Request, Router } from 'express';

import type { RateLimitPolicy } from '@/features/rate-limit/rate-limit.policy.js';
import { clientIp } from '@/shared/client-ip.js';
import {
  type RateLimitSubject,
  withFailureAccounting,
} from '@/http/middleware/failure-accounting.js';

import { parseNormalizedEmail } from './login.command.js';
import { loginController } from './login.controller.js';
import type { LoginService } from './login.service.js';

function loginSubject(request: Request): RateLimitSubject {
  return {
    ip: clientIp(request),
    email: parseNormalizedEmail((request.body as { email?: unknown } | undefined)?.email),
  };
}

export function createLoginRouter(dependencies: {
  login: LoginService;
  rateLimits: RateLimitPolicy;
}): Router {
  const router = Router();

  router.post(
    '/login',
    withFailureAccounting(
      dependencies.rateLimits,
      loginSubject,
      loginController(dependencies.login),
    ),
  );

  return router;
}

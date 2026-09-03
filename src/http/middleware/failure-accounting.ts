import type { Request, RequestHandler, Response } from 'express';

import {
  COUNTS_AS_FAILED_ATTEMPT,
  type RateLimitPolicy,
} from '@/features/rate-limit/rate-limit.policy.js';
import { ApiError } from '@/shared/api-error.js';

export type RateLimitSubject = {
  readonly ip: string;
  readonly email: string | undefined;
};

export type Controller = (request: Request, response: Response) => Promise<void>;

export function withFailureAccounting(
  rateLimits: RateLimitPolicy,
  subjectOf: (request: Request) => RateLimitSubject,
  handler: Controller,
): RequestHandler {
  return async (request, response, next) => {
    const { ip, email } = subjectOf(request);

    try {
      await rateLimits.assertAllowed(ip, email);
      await handler(request, response);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_SERVER_ERROR';

      if (COUNTS_AS_FAILED_ATTEMPT.has(code)) {
        try {
          await rateLimits.recordClientFailure(ip, email);
        } catch (e) {
          next(e);
          return;
        }
      }

      next(error);
    }
  };
}

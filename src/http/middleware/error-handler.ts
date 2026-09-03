import type { ErrorRequestHandler } from 'express';

import { RateLimitExceededError } from '@/features/rate-limit/rate-limit.policy.js';
import { ApiError } from '@/shared/api-error.js';
import { describeError, log } from '@/shared/logger.js';

import type { RequestWithId } from './request-id.js';

export function errorMiddleware(): ErrorRequestHandler {
  return (error: unknown, request, response, next) => {
    const requestId = (request as RequestWithId).requestId;
    const apiError = error instanceof ApiError ? error : new ApiError('INTERNAL_SERVER_ERROR');

    if (!(error instanceof ApiError)) {
      log.forRequest(requestId).internalFailure('request.unexpected_failure', describeError(error));
    } else if (error.cause !== undefined) {
      log.forRequest(requestId).internalFailure('request.dependency_failure', {
        code: error.code,
        ...describeError(error.cause),
      });
    }

    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof RateLimitExceededError) {
      response.setHeader('Retry-After', String(error.retryAfter));
    }
    response.status(apiError.status).json(apiError.toEnvelope());
  };
}

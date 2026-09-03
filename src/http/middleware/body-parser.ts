import express, { type ErrorRequestHandler, type RequestHandler } from 'express';

import type { RateLimitPolicy } from '@/features/rate-limit/rate-limit.policy.js';
import { ApiError } from '@/shared/api-error.js';
import { clientIp } from '@/shared/client-ip.js';

export function jsonBodyMiddleware(): RequestHandler {
  return express.json();
}

// i18n or this bicycle
const BODY_FAILURE_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'Malformed JSON',
  'entity.too.large': 'Request body is too large',
  'entity.verify.failed': 'Malformed JSON',
  'request.aborted': 'Request body was not fully received',
  'request.size.invalid': 'Request body length did not match Content-Length',
  'encoding.unsupported': 'Unsupported content encoding',
  'charset.unsupported': 'Unsupported charset',
  'parameters.too.many': 'Too many fields in the request body',
};

function bodyFailureType(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;
  const { type } = error;
  return typeof type === 'string' && type in BODY_FAILURE_MESSAGES ? type : undefined;
}

export function malformedJsonMiddleware(rateLimits: RateLimitPolicy): ErrorRequestHandler {
  return async (error, request, _response, next) => {
    const type = bodyFailureType(error);
    if (type === undefined) {
      next(error);
      return;
    }

    const ip = clientIp(request);
    try {
      await rateLimits.assertAllowed(ip);
      await rateLimits.recordClientFailure(ip);
      next(
        new ApiError('VALIDATION_ERROR', {
          details: [{ path: [], message: BODY_FAILURE_MESSAGES[type] ?? 'Malformed JSON' }],
        }),
      );
    } catch (e) {
      next(e);
    }
  };
}

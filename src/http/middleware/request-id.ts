import type { Request, RequestHandler } from 'express';

import { log } from '@/shared/logger.js';

export type RequestWithId = Request & { requestId: string };

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function requestIdMiddleware(): RequestHandler {
  return (request, response, next) => {
    const received = request.get('X-Request-ID');
    const requestId =
      received !== undefined && SAFE_REQUEST_ID.test(received) ? received : crypto.randomUUID();
    (request as RequestWithId).requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    const requestLog = log.forRequest(requestId);

    response.on('finish', () =>
      requestLog.requestCompleted({
        status: response.statusCode,
        method: request.method,
        path: request.path,
      }),
    );
    next();
  };
}

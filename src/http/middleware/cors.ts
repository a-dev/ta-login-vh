import cors from 'cors';
import type { RequestHandler } from 'express';

export function corsMiddleware(origin: string): RequestHandler {
  return cors({
    origin,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-ID', 'Retry-After'],
    credentials: false,
  });
}

import type { Request } from 'express';

import { normalizeIpAddress } from './normalize.js';

export function clientIp(request: Request): string {
  return normalizeIpAddress(request.ip ?? '');
}

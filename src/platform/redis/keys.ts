import { createHash } from 'node:crypto';

import { normalizeEmail, normalizeIpAddress } from '@/shared/normalize.js';

// session:<jti>
export function sessionKey(jti: string): string {
  return `session:${jti}`;
}

// rate-limit:ip:<ip>
export function ipRateLimitKey(ip: string): string {
  return `rate-limit:ip:${normalizeIpAddress(ip)}`;
}

// rate-limit:email:<sha256> hashed email address for privacy
export function emailRateLimitKey(email: string): string {
  const emailHash = createHash('sha256').update(normalizeEmail(email), 'utf8').digest('hex');
  return `rate-limit:email:${emailHash}`;
}

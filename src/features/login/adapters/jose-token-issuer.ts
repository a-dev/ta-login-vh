import { SignJWT } from 'jose';

import type { AppConfig } from '@/config/env.js';

import { ACCESS_TOKEN_TTL_SECONDS } from '../login.policy.js';
import type { TokenIssuer } from '../ports.js';

export function createJoseTokenIssuer(
  config: Pick<AppConfig, 'JWT_SECRET' | 'JWT_ISSUER' | 'JWT_AUDIENCE'>,
): TokenIssuer {
  const signingKey = new TextEncoder().encode(config.JWT_SECRET);

  return {
    async issue(userId) {
      const issuedAt = Math.floor(Date.now() / 1000);
      const expirationTime = issuedAt + ACCESS_TOKEN_TTL_SECONDS;

      const jti = crypto.randomUUID();

      const token = await new SignJWT({ token_use: 'access' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(config.JWT_ISSUER)
        .setAudience(config.JWT_AUDIENCE)
        .setSubject(userId)
        .setJti(jti)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expirationTime)
        .sign(signingKey);

      const expiresAt = new Date(expirationTime * 1000);

      return { token, jti, expiresAt };
    },
  };
}

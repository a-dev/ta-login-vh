import { ApiError } from '@/shared/api-error.js';

import { isDisposableEmailDomain } from './email-policy.js';
import type { LoginCommand, LoginResult } from './login.command.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './login.policy.js';
import type { PasswordVerifier, SessionStore, TokenIssuer, UserRepository } from './ports.js';

export type LoginService = {
  login(command: LoginCommand): Promise<LoginResult>;
};

export function createLoginService(dependencies: {
  users: UserRepository;
  passwords: PasswordVerifier;
  tokens: TokenIssuer;
  sessions: SessionStore;
}): LoginService {
  return {
    async login(command) {
      if (isDisposableEmailDomain(command.email)) {
        throw new ApiError('DISPOSABLE_EMAIL_NOT_ALLOWED');
      }

      let user;
      try {
        user = await dependencies.users.findForAuthentication(command.email);
      } catch (error) {
        throw new ApiError('SERVICE_UNAVAILABLE', { cause: error });
      }

      let passwordMatches;
      try {
        passwordMatches = await dependencies.passwords.verify(
          command.password,
          user?.passwordHash ?? null,
        );
      } catch (error) {
        throw new ApiError('INTERNAL_SERVER_ERROR', { cause: error });
      }

      if (user === null || !user.isActive || !passwordMatches) {
        throw new ApiError('INVALID_CREDENTIALS');
      }

      let issued;
      try {
        issued = await dependencies.tokens.issue(user.id);
      } catch (error) {
        throw new ApiError('INTERNAL_SERVER_ERROR', { cause: error });
      }

      try {
        await dependencies.sessions.persistLoginSuccess(issued.jti, user.id, user.email);
      } catch (error) {
        throw new ApiError('SERVICE_UNAVAILABLE', { cause: error });
      }

      return {
        accessToken: issued.token,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: { id: user.id, email: user.email },
      };
    },
  };
}

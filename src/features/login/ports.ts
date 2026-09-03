export type AuthenticationUser = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
};

export type UserRepository = {
  findForAuthentication(email: string): Promise<AuthenticationUser | null>;
};

export type PasswordVerifier = {
  verify(password: string, passwordHash: string | null): Promise<boolean>;
};

export type IssuedToken = {
  token: string;
  jti: string;
  expiresAt: Date;
};

export type TokenIssuer = {
  issue(userId: string): Promise<IssuedToken>;
};

export type SessionStore = {
  persistLoginSuccess(jti: string, userId: string, email: string, createdAt?: Date): Promise<void>;
};

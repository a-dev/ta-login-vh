import type { PasswordVerifier } from '../ports.js';

export const ARGON2_OPTIONS = {
  algorithm: 'argon2id',
  memoryCost: 65_536, // 64 MiB per hash
  timeCost: 2,
} as const;

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, ARGON2_OPTIONS);
}

export async function createArgon2PasswordVerifier(): Promise<PasswordVerifier> {
  const dummyHash = await hashPassword(crypto.randomUUID());

  return {
    verify(password, passwordHash) {
      return Bun.password.verify(password, passwordHash ?? dummyHash, ARGON2_OPTIONS.algorithm);
    },
  };
}

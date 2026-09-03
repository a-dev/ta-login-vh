import { hashPassword } from '@/features/login/adapters/argon2-password-verifier.js';
import { isDisposableEmailDomain } from '@/features/login/email-policy.js';
import { loginSchema } from '@/features/login/login.command.js';

import type { AppConfig } from '@/config/env.js';
import type { LoginCommand } from '@/features/login/login.command.js';
import type { MysqlPool } from '@/platform/mysql.js';

function validateSeedUser(config: AppConfig): LoginCommand {
  const parsed = loginSchema.safeParse({
    email: config.SEED_USER_EMAIL,
    password: config.SEED_USER_PASSWORD,
  });

  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => `SEED_USER_${String(issue.path[0]).toUpperCase()} ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid seed user configuration: ${fields}`);
  }

  if (isDisposableEmailDomain(parsed.data.email)) {
    throw new Error('SEED_USER_EMAIL must not use a disposable email domain');
  }

  return parsed.data;
}

export async function seedUser(pool: MysqlPool, config: AppConfig): Promise<void> {
  const { email, password } = validateSeedUser(config);
  const passwordHash = await hashPassword(password);

  await pool.execute(
    `INSERT INTO users (email, password_hash, is_active)
     VALUES (?, ?, TRUE)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = TRUE`,
    [email, passwordHash],
  );
}

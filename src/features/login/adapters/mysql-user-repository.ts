import type { RowDataPacket } from 'mysql2/promise';

import type { MysqlPool } from '@/platform/mysql.js';

import type { UserRepository } from '../ports.js';

type AuthenticationUserRow = RowDataPacket & {
  id: string | number | bigint;
  email: string;
  password_hash: string;
  is_active: 0 | 1 | boolean;
};

export function createMysqlUserRepository(pool: MysqlPool): UserRepository {
  return {
    async findForAuthentication(email) {
      const rows = await pool.execute<AuthenticationUserRow[]>(
        // safe
        'SELECT id, email, password_hash, is_active FROM users WHERE email = ? LIMIT 1',
        [email],
      );
      const user = rows[0];

      if (user === undefined) {
        return null;
      }

      return {
        id: String(user.id),
        email: user.email,
        passwordHash: user.password_hash,
        // convert TINYINT(1) to boolean
        isActive: user.is_active === true || user.is_active === 1,
      };
    },
  };
}

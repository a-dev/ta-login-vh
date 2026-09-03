import { createPool, type ExecuteValues, type RowDataPacket } from 'mysql2/promise';

import type { AppConfig } from '@/config/env.js';

export type MysqlPool = {
  // for seed and setup
  execute<Rows extends RowDataPacket[]>(statement: string, values?: ExecuteValues[]): Promise<Rows>;
  checkConnection(): Promise<void>;
  close(): Promise<void>;
};

export function createMysqlPool(config: AppConfig): MysqlPool {
  const pool = createPool({
    host: config.MYSQL_HOST,
    port: config.MYSQL_PORT,
    database: config.MYSQL_DATABASE,
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  return {
    async execute<Rows extends RowDataPacket[]>(
      statement: string,
      values: ExecuteValues[] = [],
    ): Promise<Rows> {
      const [rows] = await pool.execute<Rows>(statement, values);
      return rows;
    },

    async checkConnection() {
      const connection = await pool.getConnection();
      try {
        await connection.ping();
      } finally {
        connection.release();
      }
    },

    close: () => pool.end(),
  };
}

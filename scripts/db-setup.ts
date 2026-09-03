// db-init
import { loadConfig } from '@/config/env.js';
import { createMysqlPool } from '@/platform/mysql.js';
import { seedUser } from './seed-user.js';

const config = loadConfig();
const pool = createMysqlPool(config);

try {
  // CREATE TABLE IF NOT EXISTS
  const schema = await Bun.file(new URL('../db/schema.sql', import.meta.url)).text();
  await pool.execute(schema);
  await seedUser(pool, config);
  console.info('Database schema and seed user are ready');
} finally {
  await pool.close();
}

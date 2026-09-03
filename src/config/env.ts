import { z } from 'zod';

const requiredString = z.string().trim().min(1);

const booleanFromEnvironment = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const port = z.coerce.number().int().min(1).max(65_535);

const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

export const environmentSchema = z.object({
  PORT: port.default(3005),
  CORS_ORIGIN: z.url(),
  TRUST_PROXY: booleanFromEnvironment,
  MYSQL_HOST: requiredString,
  MYSQL_PORT: port.default(3306),
  MYSQL_DATABASE: requiredString,
  MYSQL_USER: requiredString,
  MYSQL_PASSWORD: requiredString,
  REDIS_URL: z.url(),
  JWT_SECRET: requiredString.refine((value) => utf8ByteLength(value) >= 32, {
    message: 'must contain at least 32 UTF-8 bytes',
  }),
  JWT_ISSUER: requiredString,
  JWT_AUDIENCE: requiredString,
  SEED_USER_EMAIL: requiredString,
  SEED_USER_PASSWORD: requiredString,
});

const compiledEnvironmentSchema = z.compile(environmentSchema);

export type AppConfig = z.output<typeof environmentSchema>;

export class ConfigurationError extends Error {
  override name = 'ConfigurationError';
}

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): AppConfig {
  const result = compiledEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new ConfigurationError(`Invalid configuration: ${fields}`);
  }

  return result.data;
}

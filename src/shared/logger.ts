import { pino, type Logger, type LoggerOptions } from 'pino';

export type LogSeverity = 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, string | number | boolean | null>>;

const CREDENTIALS_IN_URL = /\/\/[^/\s:@]+:[^/\s@]+@/g;

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;

function scrub(value: string, limit: number): string {
  // strip of `//user:password@`
  return value.replace(CREDENTIALS_IN_URL, '//[redacted]@').slice(0, limit);
}

export function describeError(error: unknown): LogFields {
  if (!(error instanceof Error)) return { error: 'UnknownError' };

  return {
    error: error.name,
    message: scrub(error.message, MAX_MESSAGE_LENGTH),
    ...(error.stack === undefined ? {} : { stack: scrub(error.stack, MAX_STACK_LENGTH) }),
  };
}

// remove from logs any sensitive fields
const REDACTED_PATHS = [
  'fields.password',
  'fields.passwordHash',
  'fields.password_hash',
  'fields.email',
  'fields.token',
  'fields.accessToken',
  'fields.jwt',
  'fields.authorization',
  'fields.secret',
  'fields.body',
  'fields.url',
];

const options: LoggerOptions = {
  level: 'info',
  base: null,
  messageKey: 'event',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ severity: label }),
  },
  redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
};

function createRootLogger(): Logger {
  // development environment tty
  if (process.stdout.isTTY) {
    try {
      return pino({
        ...options,
        transport: {
          target: 'pino-pretty',
          options: {
            messageKey: 'event',
            levelKey: 'severity',
            timestampKey: 'timestamp',
            levelLabel: 'severity',
          },
        },
      });
    } catch {}
  }

  return pino(options);
}

/** Writes one record: the event name as the message, everything else under `fields`. */
function emit(logger: Logger, severity: LogSeverity, event: string, fields?: LogFields) {
  logger[severity](fields === undefined ? {} : { fields }, event);
}

const logger = createRootLogger();

// logging vocabulary
function createLog(logger: Logger) {
  return {
    startup: (fields?: LogFields) => emit(logger, 'info', 'startup', fields),
    shutdown: (fields?: LogFields) => emit(logger, 'info', 'shutdown', fields),
    requestCompleted: (fields: LogFields) => emit(logger, 'info', 'request.completed', fields),
    internalFailure: (event: string, fields?: LogFields) => emit(logger, 'error', event, fields),
    forRequest: (requestId: string) => createLog(logger.child({ requestId })), // request-scoped logger
  };
}

export const log = createLog(logger);
export type Log = ReturnType<typeof createLog>;

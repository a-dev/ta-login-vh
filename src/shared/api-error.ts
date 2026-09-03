export const errorDefinitions = {
  VALIDATION_ERROR: { status: 400, message: 'Invalid request' },
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  DISPOSABLE_EMAIL_NOT_ALLOWED: {
    status: 403,
    message: 'Disposable email addresses are not allowed',
  },
  RATE_LIMIT_EXCEEDED: { status: 429, message: 'Too many login attempts' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable' },
  INTERNAL_SERVER_ERROR: { status: 500, message: 'Internal server error' },
} as const;

export type ErrorCode = keyof typeof errorDefinitions;

export type ApiErrorDetails = ReadonlyArray<{
  path: ReadonlyArray<string | number>;
  message: string;
}>;

export type ErrorEnvelope = {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetails;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ApiErrorDetails | undefined;

  constructor(
    code: ErrorCode,
    options: { details?: ApiErrorDetails; message?: string; cause?: unknown } = {},
  ) {
    const definition = errorDefinitions[code];
    super(options.message ?? definition.message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = definition.status;
    this.code = code;
    this.details = options.details;
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

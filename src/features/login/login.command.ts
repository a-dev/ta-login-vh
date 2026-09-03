import { z } from 'zod';

import { normalizeEmail } from '@/shared/normalize.js';

/**
 * Email regex.
 * Deliberately stricter than RFC 5322. Two kinds of real address fail here:
 * quoted local parts like `"john doe"@example.com`, and non-ASCII ones like
 * `josé@example.com`.
 *
 * Taken from the WHATWG HTML `<input type="email">` validity regex:
 * https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
 * One change: the last group repeats with `+`, not `*`, so `root@localhost`
 * fails here even though a browser accepts it.
 *
 * The local part is RFC 5322 atext plus the dot, and like the spec it allows
 * dots the RFC does not, so `.a@b.com` and `a..b@c.com` pass.
 */
const ASCII_EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export const loginEmailSchema = z
  .string()
  .refine(
    (email) => {
      const normalizedEmail = normalizeEmail(email);
      return normalizedEmail.length <= 254 && ASCII_EMAIL_PATTERN.test(normalizedEmail);
    },
    { message: 'must be a valid ASCII email address no longer than 254 characters' },
  )
  .transform(normalizeEmail);

export const loginSchema = z
  .object({
    email: loginEmailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginCommand = z.output<typeof loginSchema>;

export type LoginResult = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    email: string;
  };
};

export type LoginValidationIssue = Readonly<{
  path: ReadonlyArray<string | number>;
  message: string;
}>;

function sanitizeIssues(error: z.ZodError): ReadonlyArray<LoginValidationIssue> {
  return error.issues.map((issue) => ({
    path: issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number',
    ),
    message: issue.message,
  }));
}

export type ParseLoginCommandResult =
  | Readonly<{ success: true; command: LoginCommand }>
  | Readonly<{ success: false; issues: ReadonlyArray<LoginValidationIssue> }>;

export function parseLoginCommand(input: unknown): ParseLoginCommandResult {
  const result = loginSchema.safeParse(input);

  if (!result.success) {
    return { success: false, issues: sanitizeIssues(result.error) };
  }

  return { success: true, command: result.data };
}

export function parseNormalizedEmail(input: unknown): string | undefined {
  const result = loginEmailSchema.safeParse(input);
  return result.success ? result.data : undefined;
}

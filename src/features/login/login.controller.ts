import type { Controller } from '@/http/middleware/failure-accounting.js';
import { ApiError } from '@/shared/api-error.js';

import { parseLoginCommand } from './login.command.js';
import type { LoginService } from './login.service.js';

export function loginController(login: LoginService): Controller {
  return async (request, response) => {
    const parsed = parseLoginCommand(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_ERROR', { details: parsed.issues });

    const result = await login.login(parsed.command);
    response.setHeader('Cache-Control', 'no-store').status(200).json(result);
  };
}

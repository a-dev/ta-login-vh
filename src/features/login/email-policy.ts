import { normalizeEmail } from '@/shared/normalize.js';

import { generatedDisposableDomains } from './disposable-domains.generated.js';

export const additionalDisposableDomains: readonly string[] = ['mailinator.com'];

export const allowedDomains: readonly string[] = ['gmail.com'];

// built once at module load
const allowed = new Set(allowedDomains);
const blocked = new Set(generatedDisposableDomains);
for (const domain of additionalDisposableDomains) blocked.add(domain);

export function isDisposableDomain(domain: string): boolean {
  let candidate = domain.trim().toLowerCase().replace(/\.+$/, ''); // remove last dot if exists

  while (candidate.length > 0) {
    if (allowed.has(candidate)) return false;
    if (blocked.has(candidate)) return true;

    // Check on every level of the domain hierarchy from most to least specific
    const separator = candidate.indexOf('.');
    if (separator === -1) return false;
    candidate = candidate.slice(separator + 1);
  }

  return false;
}

export function isDisposableEmailDomain(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  const separator = normalizedEmail.lastIndexOf('@');
  const domain = separator === -1 ? normalizedEmail : normalizedEmail.slice(separator + 1);
  return isDisposableDomain(domain);
}

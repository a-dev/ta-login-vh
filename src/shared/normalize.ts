import { isIPv4 } from 'node:net';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeIpAddress(ip: string): string {
  const normalized = ip.trim().toLowerCase();
  // ::ffff:127.0.0.1 to 127.0.0.1
  const mappedIpv4 = normalized.startsWith('::ffff:')
    ? normalized.slice('::ffff:'.length)
    : normalized;

  return isIPv4(mappedIpv4) ? mappedIpv4 : normalized;
}

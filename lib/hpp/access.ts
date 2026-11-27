export const HPP_ROUTE = '/hpp-cost-intelligence';
const HPP_READ_ROLES: ReadonlySet<string> = new Set([
  'ADMIN_SYSTEM',
  'STAFF_ACCOUNTING',
  'SUPERVISOR_ACCOUNTING',
  'AUDITOR_INTERNAL',
  'STAFF_PRODUCTION',
]);

export function canReadHpp(role: string | null | undefined): boolean {
  return typeof role === 'string' && HPP_READ_ROLES.has(role);
}

export function isHppPath(pathname: string): boolean {
  return pathname === HPP_ROUTE || pathname.startsWith(HPP_ROUTE + '/');
}

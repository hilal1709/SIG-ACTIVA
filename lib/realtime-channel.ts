const REALTIME_CHANNEL_PREFIX = 'private-sig-activa-role:';

const ALLOWED_REALTIME_ROLES = new Set([
  'ADMIN_SYSTEM',
  'STAFF_ACCOUNTING',
  'SUPERVISOR_ACCOUNTING',
  'AUDITOR_INTERNAL',
  'STAFF_PRODUCTION',
]);

function normalizeRole(input: string): string {
  return input.trim().toUpperCase();
}

export function isAllowedRealtimeRole(role: string): boolean {
  return ALLOWED_REALTIME_ROLES.has(normalizeRole(role));
}

export function getRealtimeChannelForRole(role: string): string {
  const normalizedRole = normalizeRole(role);
  return `${REALTIME_CHANNEL_PREFIX}${normalizedRole}`;
}

export function getAllRealtimeChannels(): string[] {
  return [...ALLOWED_REALTIME_ROLES].map((role) => getRealtimeChannelForRole(role));
}

export function getRoleFromRealtimeChannel(channelName: string): string | null {
  if (!channelName.startsWith(REALTIME_CHANNEL_PREFIX)) return null;
  const role = channelName.slice(REALTIME_CHANNEL_PREFIX.length).trim();
  if (!role) return null;
  return isAllowedRealtimeRole(role) ? role : null;
}

import PushNotifications from '@pusher/push-notifications-server';

let beamsClient: PushNotifications | null = null;
let beamsWarningLogged = false;

function getBeamsClient(): PushNotifications | null {
  if (beamsClient) return beamsClient;

  const instanceId = process.env.BEAMS_INSTANCE_ID;
  const secretKey = process.env.BEAMS_PRIMARY_KEY;

  if (!instanceId || !secretKey) {
    const message = 'Beams env vars are not fully configured';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }

    if (!beamsWarningLogged) {
      console.warn(`[Beams] ${message}; push notifications are disabled outside production.`);
      beamsWarningLogged = true;
    }
    return null;
  }

  beamsClient = new PushNotifications({
    instanceId,
    secretKey,
  });

  return beamsClient;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: 'high' | 'medium' | 'low';
}

const DEFAULT_ROLE_INTERESTS = [
  'role:ADMIN_SYSTEM',
  'role:STAFF_ACCOUNTING',
  'role:SUPERVISOR_ACCOUNTING',
  'role:AUDITOR_INTERNAL',
  'role:STAFF_PRODUCTION',
];

function resolveInterests(interest?: string): string[] {
  if (interest && interest.trim()) {
    return [interest.trim()];
  }

  const includeLegacyAllUsers = process.env.BEAMS_INCLUDE_LEGACY_ALL_USERS === 'true';
  return includeLegacyAllUsers
    ? [...DEFAULT_ROLE_INTERESTS, 'all-users']
    : DEFAULT_ROLE_INTERESTS;
}

/**
 * Send a push notification to subscribers of role-based interests.
 * If `interest` is provided, publish only to that specific interest.
 */
export async function sendPushToAll(
  payload: PushPayload,
  interest?: string
) {
  try {
    const client = getBeamsClient();
    const interests = resolveInterests(interest);

    if (!client) {
      return { interests, skipped: true };
    }

    await client.publishToInterests(interests, {
      web: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192x192.png',
        },
      },
    });
    console.log(`[Beams] Push notification sent to interests: ${interests.join(', ')}`);
  } catch (error) {
    console.error('[Beams] Failed to send push notification:', error);
    throw error;
  }
  return { interests: resolveInterests(interest) };
}

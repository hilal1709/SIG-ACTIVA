import Pusher from 'pusher';
import { getAllRealtimeChannels, getRealtimeChannelForRole, isAllowedRealtimeRole } from '@/lib/realtime-channel';

/**
 * Pusher Channels broadcaster.
 * Replaces SSE to avoid persistent Vercel Fluid connections.
 * Channels: private-sig-activa-role:<ROLE>, events: 'accrual' | 'prepaid' | 'material' | 'fluktuasi' | 'users'
 */

let _pusher: Pusher | null = null;
let _pusherWarningLogged = false;

type BroadcastOptions = {
  roles?: string[];
};

function getPusherConfig() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (appId && key && secret && cluster) {
    return { appId, key, secret, cluster };
  }

  return null;
}

function getPusher(): Pusher | null {
  if (!_pusher) {
    const config = getPusherConfig();
    if (!config) {
      const message = 'Pusher env vars are not fully configured';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(message);
      }

      if (!_pusherWarningLogged) {
        console.warn(`[Pusher] ${message}; broadcast is disabled outside production.`);
        _pusherWarningLogged = true;
      }
      return null;
    }

    _pusher = new Pusher({
      ...config,
      useTLS: true,
    });
  }
  return _pusher;
}

/** Fire-and-forget broadcast to all subscribed clients. */
export function broadcast(event: string, data?: Record<string, unknown>, options?: BroadcastOptions) {
  const pusher = getPusher();
  if (!pusher) return;

  const channels = options?.roles?.length
    ? [...new Set(options.roles.map((role) => role.trim().toUpperCase()))]
        .filter((role) => isAllowedRealtimeRole(role))
        .map((role) => getRealtimeChannelForRole(role))
    : getAllRealtimeChannels();

  for (const channel of channels) {
    pusher.trigger(channel, event, data ?? {}).catch((err: unknown) => {
      console.error('[Pusher] broadcast error:', err);
    });
  }
}

/** Legacy no-ops kept so SSE route import doesn't break during transition. */
export function addClient() {}
export function removeClient() {}

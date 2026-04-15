import Pusher, { Channel } from 'pusher-js';
import { useEffect, useRef } from 'react';
import { getRealtimeChannelForRole, isAllowedRealtimeRole } from '@/lib/realtime-channel';

type Handler = (event: string, data?: Record<string, unknown>) => void;

// ─── Singleton Pusher instance shared across all hook usages per tab ──────────
let _pusherClient: Pusher | null = null;
let _channel: Channel | null = null;
let _refCount = 0;
let _missingConfigWarningLogged = false;

function getSharedChannel(): Channel | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  const role = (typeof window !== 'undefined' ? localStorage.getItem('userRole') : '') || '';
  const normalizedRole = role.trim().toUpperCase();
  const channelName = isAllowedRealtimeRole(normalizedRole)
    ? getRealtimeChannelForRole(normalizedRole)
    : null;

  if (!key || !cluster || !channelName) {
    if (!_missingConfigWarningLogged) {
      console.warn('[Pusher] Realtime config or role is missing/invalid; realtime updates are disabled.');
      _missingConfigWarningLogged = true;
    }
    return null;
  }

  if (!_pusherClient) {
    _pusherClient = new Pusher(key, {
      cluster,
      authEndpoint: '/api/realtime/pusher-auth',
      authTransport: 'ajax',
    });
  }
  if (!_channel) {
    _channel = _pusherClient.subscribe(channelName);
  }
  _refCount++;
  return _channel;
}

function releaseSharedChannel() {
  _refCount--;
  if (_refCount <= 0 && _pusherClient) {
    const role = (typeof window !== 'undefined' ? localStorage.getItem('userRole') : '') || '';
    const normalizedRole = role.trim().toUpperCase();
    if (isAllowedRealtimeRole(normalizedRole)) {
      _pusherClient.unsubscribe(getRealtimeChannelForRole(normalizedRole));
    }
    _pusherClient.disconnect();
    _pusherClient = null;
    _channel = null;
    _refCount = 0;
  }
}

/**
 * Subscribe to real-time events via Pusher Channels.
 * Uses a shared singleton connection — multiple callers share one WebSocket.
 */
export function useRealtimeUpdates(events: string[], onUpdate: Handler) {
  const onUpdateRef = useRef<Handler>(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const channel = getSharedChannel();
    if (!channel) return;

    // unique handler per hook instance so unbind works correctly
    const handlers: Record<string, (data?: Record<string, unknown>) => void> = {};

    for (const name of events) {
      const handler = (data?: Record<string, unknown>) => onUpdateRef.current(name, data);
      handlers[name] = handler;
      channel.bind(name, handler);
    }

    return () => {
      for (const [name, handler] of Object.entries(handlers)) {
        channel.unbind(name, handler);
      }
      releaseSharedChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

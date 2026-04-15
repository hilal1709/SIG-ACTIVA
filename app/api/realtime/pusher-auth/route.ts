import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { requireSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getRealtimeChannelForRole, getRoleFromRealtimeChannel } from '@/lib/realtime-channel';

function getPusherServer(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;

  const clientIp = getClientIp(request);
  const ipRateLimit = await checkRateLimit(
    `pusher-auth:uid:${auth.user.uid}:ip:${clientIp}`,
    30,
    60_000
  );
  if (!ipRateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan auth realtime. Coba lagi sebentar.' },
      { status: 429, headers: { 'Retry-After': String(ipRateLimit.retryAfterSec) } }
    );
  }

  const formData = await request.formData();
  const socketId = String(formData.get('socket_id') ?? '').trim();
  const channelName = String(formData.get('channel_name') ?? '').trim();

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
  }

  const requestedRole = getRoleFromRealtimeChannel(channelName);
  const expectedChannel = getRealtimeChannelForRole(auth.user.role);
  if (!requestedRole || channelName !== expectedChannel) {
    return NextResponse.json({ error: 'Forbidden channel' }, { status: 403 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: 'Pusher not configured' }, { status: 503 });
  }

  const authResponse = pusher.authorizeChannel(socketId, channelName, {
    user_id: String(auth.user.uid),
    user_info: {
      role: auth.user.role,
      name: auth.user.name,
    },
  });

  return NextResponse.json(authResponse);
}
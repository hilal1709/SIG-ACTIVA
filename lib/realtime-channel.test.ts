import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAllRealtimeChannels,
  getRealtimeChannelForRole,
  getRoleFromRealtimeChannel,
} from './realtime-channel';

const PUSHER_CHANNEL_PATTERN = /^[A-Za-z0-9_\-=@,.;]+$/;

test('role channels use only Pusher-safe characters and round-trip the role', () => {
  for (const channel of getAllRealtimeChannels()) {
    assert.match(channel, PUSHER_CHANNEL_PATTERN);
    const role = getRoleFromRealtimeChannel(channel);
    assert.ok(role);
    assert.equal(getRealtimeChannelForRole(role), channel);
  }
});

test('ADMIN_SYSTEM channel no longer contains the invalid colon separator', () => {
  const channel = getRealtimeChannelForRole('ADMIN_SYSTEM');
  assert.equal(channel, 'private-sig-activa-role-ADMIN_SYSTEM');
  assert.equal(channel.includes(':'), false);
});

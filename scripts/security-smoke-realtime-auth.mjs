#!/usr/bin/env node

/**
 * Smoke test untuk realtime channel authorization.
 * Menguji bahwa endpoint /api/realtime/pusher-auth menolak akses ke channel role yang tidak sesuai.
 */

const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function main() {
  console.log(`Running realtime auth smoke tests against ${baseUrl}`);
  console.log('Note: These tests check endpoint behavior without requiring a logged-in user.\n');

  const results = [];

  // Test 1: Missing required fields should return 400
  {
    const name = 'REALTIME_AUTH_MISSING_SOCKET_ID';
    try {
      const form = new FormData();
      form.append('channel_name', 'private-sig-activa-role:ADMIN_SYSTEM');
      const res = await fetch(`${baseUrl}/api/realtime/pusher-auth`, {
        method: 'POST',
        body: form,
      });
      const status = res.status;
      const pass = status === 400 || status === 401; // 400 for missing field, 401 for no auth
      results.push({ name, status, pass, expected: '400 or 401 (auth required)' });
    } catch (error) {
      results.push({ name, status: 'ERROR', pass: false, error: error.message });
    }
  }

  // Test 2: Missing channel_name should return 400
  {
    const name = 'REALTIME_AUTH_MISSING_CHANNEL';
    try {
      const form = new FormData();
      form.append('socket_id', '1234.5678');
      const res = await fetch(`${baseUrl}/api/realtime/pusher-auth`, {
        method: 'POST',
        body: form,
      });
      const status = res.status;
      const pass = status === 400 || status === 401;
      results.push({ name, status, pass, expected: '400 or 401 (auth required)' });
    } catch (error) {
      results.push({ name, status: 'ERROR', pass: false, error: error.message });
    }
  }

  // Test 3: Invalid channel name format should return 400 or 403
  {
    const name = 'REALTIME_AUTH_INVALID_CHANNEL_FORMAT';
    try {
      const form = new FormData();
      form.append('socket_id', '1234.5678');
      form.append('channel_name', 'invalid-channel-name');
      const res = await fetch(`${baseUrl}/api/realtime/pusher-auth`, {
        method: 'POST',
        body: form,
      });
      const status = res.status;
      const pass = status === 400 || status === 401 || status === 403;
      results.push({ name, status, pass, expected: '400/401/403' });
    } catch (error) {
      results.push({ name, status: 'ERROR', pass: false, error: error.message });
    }
  }

  // Test 4: Non-existent role in channel should return 403
  {
    const name = 'REALTIME_AUTH_INVALID_ROLE';
    try {
      const form = new FormData();
      form.append('socket_id', '1234.5678');
      form.append('channel_name', 'private-sig-activa-role:NONEXISTENT_ROLE');
      const res = await fetch(`${baseUrl}/api/realtime/pusher-auth`, {
        method: 'POST',
        body: form,
      });
      const status = res.status;
      const pass = status === 400 || status === 401 || status === 403;
      results.push({ name, status, pass, expected: '400/401/403' });
    } catch (error) {
      results.push({ name, status: 'ERROR', pass: false, error: error.message });
    }
  }

  // Test 5: Valid channel but no auth cookie should return 401
  {
    const name = 'REALTIME_AUTH_NO_SESSION';
    try {
      const form = new FormData();
      form.append('socket_id', '1234.5678');
      form.append('channel_name', 'private-sig-activa-role:ADMIN_SYSTEM');
      const res = await fetch(`${baseUrl}/api/realtime/pusher-auth`, {
        method: 'POST',
        body: form,
      });
      const status = res.status;
      // Should fail because no session/auth
      const pass = status === 401 || status === 403;
      results.push({ name, status, pass, expected: '401 (no session) or 403 (forbidden channel)' });
    } catch (error) {
      results.push({ name, status: 'ERROR', pass: false, error: error.message });
    }
  }

  // Print results
  console.log('=== Realtime Auth Smoke Results ===\n');
  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const statusStr = result.status === 'ERROR' ? '❌ ERROR' : result.pass ? '✅ PASS' : '❌ FAIL';
    if (result.pass) {
      passed += 1;
    } else {
      failed += 1;
    }

    const details = result.status === 'ERROR'
      ? result.error
      : `status=${result.status}, expected="${result.expected}"`;

    console.log(`${statusStr} | ${result.name.padEnd(40)} | ${details}`);
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${results.length} scenario(s)\n`);

  if (failed > 0) {
    console.error('Some realtime auth smoke tests failed.');
    process.exit(1);
  }

  console.log('All realtime auth smoke tests passed.');
}

main().catch((error) => {
  const code = error?.cause?.code || error?.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') {
    console.error(`Smoke test execution failed: cannot reach ${baseUrl}.`);
    console.error('Make sure the app is running, for example with: npm run dev');
  } else {
    console.error('Smoke test execution failed:', error);
  }
  process.exit(1);
});

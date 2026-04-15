#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const authEmail = process.env.SMOKE_AUTH_EMAIL || '';
const authPassword = process.env.SMOKE_AUTH_PASSWORD || '';

/** @typedef {{name: string, path: string, limit: number, mode: 'json' | 'form', makeBody: () => any, requireAuth?: boolean}} Scenario */

const publicScenarios = [
  {
    name: 'AUTH_LOGIN_LIMIT',
    path: '/api/auth/login',
    limit: 10,
    mode: 'json',
    makeBody: () => ({ email: 'ratelimit-test@example.invalid', password: 'wrong-pass-123' }),
  },
  {
    name: 'AUTH_REGISTER_LIMIT',
    path: '/api/auth/register',
    limit: 5,
    mode: 'json',
    makeBody: () => ({
      username: '',
      email: '',
      password: '',
      name: '',
    }),
  },
  {
    name: 'AUTH_VERIFY_EMAIL_LIMIT',
    path: '/api/auth/verify-email',
    limit: 10,
    mode: 'json',
    makeBody: () => ({ token: 'dummy-token' }),
  },
  {
    name: 'USERS_CHECK_LIMIT',
    path: '/api/users/check',
    limit: 10,
    mode: 'json',
    makeBody: () => ({ email: 'notfound@example.invalid' }),
  },
];

const authScenarios = [
  {
    name: 'REALTIME_PUSHER_AUTH_LIMIT',
    path: '/api/realtime/pusher-auth',
    limit: 30,
    mode: 'form',
    requireAuth: true,
    makeBody: () => ({
      socket_id: '1234.5678',
      channel_name: 'private-sig-activa-role:ADMIN_SYSTEM',
    }),
  },
  {
    name: 'FLUKTUASI_CHAT_LIMIT',
    path: '/api/fluktuasi/chat',
    limit: 25,
    mode: 'json',
    requireAuth: true,
    makeBody: () => ({
      model: 'google/gemini-2.0-flash-001',
      keyIdx: 0,
      systemContext: 'Security smoke test context',
      messages: [{ role: 'user', content: 'Ping smoke test' }],
    }),
  },
];

function parseSetCookieForSession(response, cookieName = 'sigactiva_session') {
  /** @type {string[]} */
  const cookieHeaders = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  for (const rawCookie of cookieHeaders) {
    const firstPart = rawCookie.split(';')[0] || '';
    const [name, value] = firstPart.split('=');
    if (name?.trim() === cookieName && value) {
      return `${cookieName}=${value}`;
    }
  }
  return null;
}

async function loginAndGetCookie() {
  if (!authEmail || !authPassword) {
    return null;
  }

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  });

  if (!res.ok) {
    return null;
  }

  return parseSetCookieForSession(res);
}

/**
 * @param {Scenario} scenario
 * @param {string | null} sessionCookie
 */
async function runScenario(scenario, sessionCookie) {
  const maxAttempts = scenario.limit + 3;
  const statuses = [];
  let hit429 = false;
  let retryAfter = null;

  for (let i = 0; i < maxAttempts; i += 1) {
    /** @type {Record<string, string>} */
    const headers = {};
    if (sessionCookie) {
      headers.Cookie = sessionCookie;
    }

    let body;
    if (scenario.mode === 'json') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(scenario.makeBody());
    } else {
      const form = new FormData();
      const data = scenario.makeBody();
      for (const [key, value] of Object.entries(data)) {
        form.append(key, String(value));
      }
      body = form;
    }

    const res = await fetch(`${baseUrl}${scenario.path}`, {
      method: 'POST',
      headers,
      body,
    });

    statuses.push(res.status);
    if (res.status === 429) {
      retryAfter = res.headers.get('Retry-After');
      hit429 = true;
      break;
    }
  }

  return {
    name: scenario.name,
    path: scenario.path,
    expectedLimit: scenario.limit,
    hit429,
    retryAfter,
    statuses,
  };
}

async function main() {
  console.log(`Running rate-limit smoke tests against ${baseUrl}`);

  const results = [];

  for (const scenario of publicScenarios) {
    results.push(await runScenario(scenario, null));
  }

  let sessionCookie = null;
  if (authEmail && authPassword) {
    sessionCookie = await loginAndGetCookie();
    if (!sessionCookie) {
      console.warn('Auth credentials provided but login failed; skipping auth-only scenarios.');
    }
  } else {
    console.log('No SMOKE_AUTH_EMAIL/SMOKE_AUTH_PASSWORD provided; skipping auth-only scenarios.');
  }

  if (sessionCookie) {
    for (const scenario of authScenarios) {
      results.push(await runScenario(scenario, sessionCookie));
    }
  }

  console.log('\n=== Smoke Result Summary ===');
  let failed = 0;
  for (const result of results) {
    const statusLabel = result.hit429 ? 'PASS' : 'FAIL';
    if (!result.hit429) failed += 1;
    console.log(
      `[${statusLabel}] ${result.name} ${result.path} | statuses=${result.statuses.join(', ')}${
        result.retryAfter ? ` | retryAfter=${result.retryAfter}` : ''
      }`
    );
  }

  if (failed > 0) {
    console.error(`\nSmoke tests finished with ${failed} failing scenario(s).`);
    process.exit(1);
  }

  console.log('\nAll smoke scenarios passed.');
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

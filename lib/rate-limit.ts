type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}
  import type { NextRequest } from 'next/server';

  type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    retryAfterSec: number;
  };

  type Bucket = {
    count: number;
    resetAt: number;
  };

  const buckets = new Map<string, Bucket>();
  const BUCKET_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
  let lastBucketSweepAt = 0;
  let redisErrorLogged = false;

  const REDIS_REST_URL = process.env.RATE_LIMIT_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_REST_TOKEN = process.env.RATE_LIMIT_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  function hasRedisRateLimitConfig() {
    return Boolean(REDIS_REST_URL && REDIS_REST_TOKEN);
  }

  function sanitizeIp(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const ip = raw.trim();
    if (!ip || ip.length > 64) return null;
    if (!/^[0-9a-fA-F:.\[\]]+$/.test(ip)) return null;
    return ip;
  }

  export function getClientIp(request: NextRequest): string {
    const candidates = [
      request.headers.get('x-real-ip'),
      request.headers.get('cf-connecting-ip'),
      request.headers.get('x-vercel-forwarded-for'),
      request.headers.get('x-client-ip'),
      request.headers.get('x-forwarded-for')?.split(',')[0],
    ];

    for (const candidate of candidates) {
      const ip = sanitizeIp(candidate);
      if (ip) return ip;
    }

    return 'unknown';
  }

  function sweepBuckets(now: number) {
    if (now - lastBucketSweepAt < BUCKET_SWEEP_INTERVAL_MS) return;

    lastBucketSweepAt = now;
    for (const [bucketKey, bucket] of buckets.entries()) {
      if (now >= bucket.resetAt) {
        buckets.delete(bucketKey);
      }
    }
  }

  async function callRedisPipeline(
    commands: Array<Array<string | number>>
  ): Promise<Array<unknown> | null> {
    if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return null;

    const res = await fetch(`${REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Redis REST error ${res.status}`);
    }

    const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    if (!Array.isArray(data)) return null;

    if (data.some((item) => item && typeof item === 'object' && 'error' in item && item.error)) {
      throw new Error('Redis REST pipeline command failed');
    }

    return data.map((item) => item?.result);
  }

  async function checkRateLimitRedis(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult | null> {
    if (!hasRedisRateLimitConfig()) return null;

    const redisKey = `rl:${key}`;
    const first = await callRedisPipeline([
      ['INCR', redisKey],
      ['PTTL', redisKey],
    ]);
    if (!first) return null;

    let count = Number(first[0] ?? 0);
    let pttl = Number(first[1] ?? -1);

    if (count <= 1 || pttl < 0) {
      const second = await callRedisPipeline([
        ['PEXPIRE', redisKey, windowMs],
        ['PTTL', redisKey],
      ]);
      if (second) {
        pttl = Number(second[1] ?? windowMs);
      } else {
        pttl = windowMs;
      }
      count = Math.max(1, count);
    }

    const retryAfterSec = Math.max(1, Math.ceil(Math.max(1, pttl) / 1000));

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      retryAfterSec,
    };
  }

  function checkRateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    sweepBuckets(now);
    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      if (existing) {
        buckets.delete(key);
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)),
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    buckets.set(key, existing);
    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count),
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  export async function checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    if (hasRedisRateLimitConfig()) {
      try {
        const result = await checkRateLimitRedis(key, limit, windowMs);
        if (result) return result;
      } catch (error) {
        if (!redisErrorLogged) {
          console.warn('[RateLimit] Redis backend unavailable, fallback to in-memory limiter.', error);
          redisErrorLogged = true;
        }
      }
    }

    return checkRateLimitMemory(key, limit, windowMs);
  }

/**
 * Rate limiter for API endpoints.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars are present,
 * uses @upstash/ratelimit with a sliding window algorithm for global rate limiting
 * across serverless instances (survives cold starts).
 *
 * Falls back to in-memory limiting when those env vars are not set (local dev).
 * Note: In-memory mode works per-instance — each cold start gets a fresh map,
 * providing basic burst protection rather than strict global rate limiting.
 */

interface RateLimitConfig {
  /** Unique identifier for this limiter (e.g., 'contact', 'lead-form') */
  id: string;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev / no Redis)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const inMemoryLimiters = new Map<string, Map<string, RateLimitEntry>>();

function inMemoryRateLimit(
  id: string,
  ip: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();

  if (!inMemoryLimiters.has(id)) {
    inMemoryLimiters.set(id, new Map());
  }
  const store = inMemoryLimiters.get(id)!;

  // Evict expired entries to prevent unbounded growth
  if (store.size > 100) {
    for (const [key, val] of store) {
      if (now > val.resetAt) store.delete(key);
    }
  }

  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowSeconds * 1000 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ---------------------------------------------------------------------------
// Upstash-backed limiter (production) — lazy singleton
// ---------------------------------------------------------------------------

type UpstashLimiterFn = (
  id: string,
  ip: string,
  limit: number,
  windowSeconds: number
) => Promise<RateLimitResult>;

let upstashLimiterPromise: Promise<UpstashLimiterFn | null> | null = null;
let rateLimitFallbackWarned = false;

async function getUpstashLimiter(): Promise<UpstashLimiterFn | null> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || (typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_URL : undefined);
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || (typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_TOKEN : undefined);

  if (!url || !token) return null;

  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import('@upstash/ratelimit'),
    import('@upstash/redis'),
  ]);

  const redis = new Redis({ url, token });

  // Cache Ratelimit instances keyed by "id:limit:windowSeconds"
  const limiterCache = new Map<string, InstanceType<typeof Ratelimit>>();

  return async (
    id: string,
    ip: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> => {
    const cacheKey = `${id}:${limit}:${windowSeconds}`;
    if (!limiterCache.has(cacheKey)) {
      limiterCache.set(
        cacheKey,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
          prefix: `rl:${id}`,
        })
      );
    }
    const limiter = limiterCache.get(cacheKey)!;
    const result = await limiter.limit(ip);

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function rateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { id, limit, windowSeconds } = config;
  const ip = getClientIP(request);

  // Lazily initialize the Upstash limiter once per process lifetime
  if (upstashLimiterPromise === null) {
    upstashLimiterPromise = getUpstashLimiter().catch(() => null);
  }

  const upstashLimiter = await upstashLimiterPromise;

  if (upstashLimiter) {
    return upstashLimiter(id, ip, limit, windowSeconds);
  }

  if (!rateLimitFallbackWarned) {
    rateLimitFallbackWarned = true;
    console.info(
      'Rate limiting: using in-memory fallback (no Upstash Redis configured).'
    );
  }

  return inMemoryRateLimit(id, ip, limit, windowSeconds);
}

/** Returns a 429 Response with appropriate headers */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  );
}

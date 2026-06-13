type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const globalRateLimit = globalThis as typeof globalThis & {
  __truqpediaRateLimitBuckets?: Map<string, RateLimitBucket>;
};

const buckets =
  globalRateLimit.__truqpediaRateLimitBuckets ??
  new Map<string, RateLimitBucket>();

globalRateLimit.__truqpediaRateLimitBuckets = buckets;

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = input.now ?? Date.now();
  const existing = buckets.get(input.key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    purgeExpiredBuckets(now);

    return {
      allowed: true,
      limit: input.limit,
      remaining: Math.max(0, input.limit - 1),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      limit: input.limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    limit: input.limit,
    remaining: Math.max(0, input.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

function purgeExpiredBuckets(now: number) {
  if (buckets.size < 5_000) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

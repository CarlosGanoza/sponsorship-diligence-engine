type RateLimitEntry = {
  count: number;
  resetAtMs: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

declare global {
  // eslint-disable-next-line no-var
  var __signalSponsorRateLimitStore: RateLimitStore | undefined;
}

function getRateLimitStore() {
  if (!globalThis.__signalSponsorRateLimitStore) {
    globalThis.__signalSponsorRateLimitStore = new Map();
  }

  return globalThis.__signalSponsorRateLimitStore;
}

function cleanupExpiredEntries(store: RateLimitStore, nowMs: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAtMs <= nowMs) {
      store.delete(key);
    }
  }
}

export function getRequestClientLabel(headersLike: Pick<Headers, "get">) {
  const forwardedFor = headersLike.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headersLike.get("x-real-ip")?.trim();
  const forwardedHost = headersLike.get("x-forwarded-host")?.trim();

  return forwardedFor || realIp || forwardedHost || "local";
}

export function consumeRateLimit(input: {
  bucket: string;
  identifier: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}) {
  const store = getRateLimitStore();
  const nowMs = input.nowMs ?? Date.now();
  const limit = Math.max(1, Math.round(input.limit));
  const windowMs = Math.max(1000, Math.round(input.windowMs));
  const key = `${input.bucket}:${input.identifier}`;

  cleanupExpiredEntries(store, nowMs);

  const existing = store.get(key);

  if (!existing || existing.resetAtMs <= nowMs) {
    const entry: RateLimitEntry = {
      count: 1,
      resetAtMs: nowMs + windowMs,
    };
    store.set(key, entry);

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetAtMs: entry.resetAtMs,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAtMs: existing.resetAtMs,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAtMs: existing.resetAtMs,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
  };
}

export function buildRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
}) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAtMs / 1000)),
    "Retry-After": String(result.retryAfterSeconds),
  };
}

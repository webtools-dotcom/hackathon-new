// In-memory: per server instance. Production would use a shared store (e.g. Redis).

export const RATE_LIMIT = { max: 20, windowMs: 60_000 } as const;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  now = Date.now()
): { ok: boolean; retryAfterSec: number } {
  if (store.size > 5_000) {
    for (const [k, entry] of store.entries()) {
      if (now - entry.windowStart >= RATE_LIMIT.windowMs) {
        store.delete(k);
      }
    }
  }

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= RATE_LIMIT.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true, retryAfterSec: 0 };
  }

  if (entry.count >= RATE_LIMIT.max) {
    const remainingMs = entry.windowStart + RATE_LIMIT.windowMs - now;
    const retryAfterSec = Math.max(1, Math.ceil(remainingMs / 1000));
    return { ok: false, retryAfterSec };
  }

  entry.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimits(): void {
  store.clear();
}

/** Small TTL cache for model responses, keyed by a SHA-256 of the request shape. */
import { createHash } from "node:crypto";

export function cacheKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly entries = new Map<string, CacheItem<T>>();

  constructor(maxEntries: number, ttlMs: number) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string, now = Date.now()): T | undefined {
    const item = this.entries.get(key);
    if (!item) {
      return undefined;
    }
    if (now >= item.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      value,
      expiresAt: now + this.ttlMs,
    });
  }

  clear(): void {
    this.entries.clear();
  }
}

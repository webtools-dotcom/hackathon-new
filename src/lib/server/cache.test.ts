import { describe, expect, it } from "vitest";
import { TtlCache, cacheKey } from "./cache";

describe("cache", () => {
  it("returns cached values until ttl expires", () => {
    const cache = new TtlCache<string>(5, 1000);
    const now = 10_000;

    cache.set("a", "alpha", now);
    expect(cache.get("a", now + 500)).toBe("alpha");
    expect(cache.get("a", now + 1000)).toBeUndefined();
    expect(cache.get("a", now + 1500)).toBeUndefined();
  });

  it("evicts the oldest entry when full", () => {
    const cache = new TtlCache<number>(2, 10_000);
    const now = 10_000;

    cache.set("k1", 1, now);
    cache.set("k2", 2, now);
    expect(cache.get("k1", now)).toBe(1);
    expect(cache.get("k2", now)).toBe(2);

    cache.set("k3", 3, now);
    expect(cache.get("k1", now)).toBeUndefined();
    expect(cache.get("k2", now)).toBe(2);
    expect(cache.get("k3", now)).toBe(3);
  });

  it("produces deterministic sha256 cacheKey", () => {
    const k1 = cacheKey({ a: 1, b: "two" });
    const k2 = cacheKey({ a: 1, b: "two" });
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[a-f0-9]{64}$/);
  });
});

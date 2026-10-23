import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows 20 requests then blocks with retryAfter", () => {
    const key = "test-ip";
    const start = 1_000_000;

    for (let i = 0; i < 20; i++) {
      const res = checkRateLimit(key, start);
      expect(res.ok).toBe(true);
      expect(res.retryAfterSec).toBe(0);
    }

    const blocked = checkRateLimit(key, start + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window", () => {
    const key = "test-ip-2";
    const start = 1_000_000;

    for (let i = 0; i < 20; i++) {
      checkRateLimit(key, start);
    }

    expect(checkRateLimit(key, start + 1000).ok).toBe(false);

    const afterWindow = checkRateLimit(key, start + 60_001);
    expect(afterWindow.ok).toBe(true);
    expect(afterWindow.retryAfterSec).toBe(0);
  });
});

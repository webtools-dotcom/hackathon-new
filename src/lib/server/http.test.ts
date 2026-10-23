import { describe, expect, it } from "vitest";
import { clientIp, jsonError, readJsonBody } from "./http";

describe("http helpers", () => {
  it("readJsonBody rejects oversized bodies", async () => {
    const bigString = "a".repeat(40 * 1024);
    const body = JSON.stringify({ data: bigString });
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-length": String(body.length) },
      body,
    });

    const res = await readJsonBody(req);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("payload_too_large");
    }
  });

  it("readJsonBody rejects invalid json", async () => {
    const req = new Request("http://localhost/test", {
      method: "POST",
      body: "not-json-at-all{",
    });

    const res = await readJsonBody(req);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("invalid_request");
    }
  });

  it("clientIp takes the first forwarded address", () => {
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");

    const reqReal = new Request("http://localhost/test", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(clientIp(reqReal)).toBe("9.8.7.6");

    const reqUnknown = new Request("http://localhost/test");
    expect(clientIp(reqUnknown)).toBe("unknown");
  });

  it("jsonError sets no-store and correct status", async () => {
    const res = jsonError("rate_limited", 429, { "Retry-After": "30" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Retry-After")).toBe("30");
    const json = await res.json();
    expect(json).toEqual({ error: "rate_limited" });
  });
});

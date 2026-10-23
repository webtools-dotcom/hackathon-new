import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("production csp blocks framing and eval", () => {
    const prodCsp = buildCsp(false);
    expect(prodCsp).toContain("frame-ancestors 'none'");
    expect(prodCsp).not.toContain("'unsafe-eval'");
    expect(prodCsp).toContain("default-src 'self'");
    expect(prodCsp).toContain("object-src 'none'");

    const devCsp = buildCsp(true);
    expect(devCsp).toContain("'unsafe-eval'");
  });

  it("sets nosniff and deny", () => {
    const headers = securityHeaders(false);
    const headerMap = new Map(headers.map((h) => [h.key, h.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(headerMap.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()"
    );
    expect(headerMap.get("Content-Security-Policy")).toBeTruthy();
  });

  it("enforces HTTPS with a two-year HSTS policy", () => {
    const hsts = securityHeaders(false).find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toBe("max-age=63072000; includeSubDomains; preload");
  });
});

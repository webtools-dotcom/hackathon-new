import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSamples } from "@/lib/engine/mask";
import { profileRows } from "@/lib/engine/profile";
import type { DatasetProfile, Plan } from "@/lib/engine/schemas";
import { validatePlan } from "@/lib/engine/validate";
import { generateSampleOrders } from "@/lib/sample-data";
import { backoff } from "@/lib/server/gemini";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { POST } from "./route";

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
      };
    },
  };
});

const sampleProfile: DatasetProfile = {
  rowCount: 362,
  columns: [
    {
      name: "date",
      kind: "date",
      piiType: null,
      distinct: 91,
      missing: 0,
      min: "2026-07-06",
      max: "2026-10-04",
      topValues: [],
    },
    {
      name: "outlet",
      kind: "category",
      piiType: null,
      distinct: 3,
      missing: 0,
      min: null,
      max: null,
      topValues: ["Baner", "Koregaon Park", "Viman Nagar"],
    },
    {
      name: "amount_inr",
      kind: "number",
      piiType: null,
      distinct: 40,
      missing: 0,
      min: 60,
      max: 1280,
      topValues: [],
    },
    {
      name: "customer_name",
      kind: "pii",
      piiType: "name",
      distinct: 20,
      missing: 0,
      min: null,
      max: null,
      topValues: [],
    },
    {
      name: "customer_phone",
      kind: "pii",
      piiType: "phone",
      distinct: 20,
      missing: 0,
      min: null,
      max: null,
      topValues: [],
    },
  ],
};

const validPlan: Plan = {
  rationale: "Analysis of sales by outlet and over time.",
  steps: [
    {
      id: "total_revenue",
      title: "Total revenue",
      kind: "total",
      agg: "sum",
      column: "amount_inr",
      by: null,
      dateColumn: null,
      interval: null,
      sort: null,
      limit: null,
      filters: [],
    },
    {
      id: "outlet_revenue",
      title: "Revenue by outlet",
      kind: "group",
      agg: "sum",
      column: "amount_inr",
      by: "outlet",
      dateColumn: null,
      interval: null,
      sort: "desc",
      limit: 10,
      filters: [],
    },
    {
      id: "weekly_revenue",
      title: "Weekly revenue",
      kind: "trend",
      agg: "sum",
      column: "amount_inr",
      by: null,
      dateColumn: "date",
      interval: "week",
      sort: null,
      limit: null,
      filters: [],
    },
  ],
};

const piiPlan: Plan = {
  rationale: "Plan that erroneously uses pii column.",
  steps: [
    {
      id: "customer_step",
      title: "Revenue by customer",
      kind: "group",
      agg: "count",
      column: null,
      by: "customer_name",
      dateColumn: null,
      interval: null,
      sort: "desc",
      limit: 10,
      filters: [],
    },
  ],
};

describe("POST /api/plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(backoff, "sleep").mockResolvedValue();
    process.env.GEMINI_API_KEY = "test-key";
    resetRateLimits();
  });

  it("returns a validated plan from gemini", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(validPlan),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    });

    const body = JSON.stringify({
      question: "Plan question 1",
      profile: sampleProfile,
      samples: [],
    });

    const req = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.1",
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.source).toBe("gemini");
    expect(data.plan.steps.length).toBe(3);
    expect(data.meta.promptTokens).toBe(100);
    expect(data.meta.outputTokens).toBe(50);
  });

  it("repairs once when the plan uses a pii column", async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        text: JSON.stringify(piiPlan),
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(validPlan),
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 50 },
      });

    const body = JSON.stringify({
      question: "Plan repair question",
      profile: sampleProfile,
      samples: [],
    });

    const req = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.2",
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);

    const data = await res.json();
    expect(data.meta.source).toBe("gemini");
    const issues = validatePlan(data.plan, sampleProfile);
    expect(issues.filter((i) => i.code === "pii_column")).toHaveLength(0);
  });

  it("falls back to the rules-based plan without an api key", async () => {
    delete process.env.GEMINI_API_KEY;

    const body = JSON.stringify({
      question: "Plan fallback question",
      profile: sampleProfile,
      samples: [],
    });

    const req = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.3",
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.source).toBe("fallback");
    expect(data.meta.model).toBeNull();
    const issues = validatePlan(data.plan, sampleProfile);
    expect(issues).toHaveLength(0);
  });

  it("serves the second identical request from cache", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(validPlan),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    });

    const body = JSON.stringify({
      question: "Cache test question",
      profile: sampleProfile,
      samples: [],
    });

    const req1 = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.4",
      },
      body,
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.meta.source).toBe("gemini");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const req2 = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.5",
      },
      body,
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.meta.source).toBe("cache");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown keys and oversized bodies", async () => {
    const unknownKeyBody = JSON.stringify({
      question: "Unknown key question",
      profile: sampleProfile,
      samples: [],
      extra_unknown_field: "disallowed",
    });

    const reqUnknown = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.6",
      },
      body: unknownKeyBody,
    });

    const resUnknown = await POST(reqUnknown);
    expect(resUnknown.status).toBe(400);
    expect(await resUnknown.json()).toEqual({ error: "invalid_request" });

    const oversizedBody = JSON.stringify({
      question: "Oversized body question",
      profile: sampleProfile,
      samples: [],
      padding: "x".repeat(35 * 1024),
    });

    const reqOversized = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(oversizedBody.length),
        "x-forwarded-for": "10.0.0.7",
      },
      body: oversizedBody,
    });

    const resOversized = await POST(reqOversized);
    expect(resOversized.status).toBe(413);
    expect(await resOversized.json()).toEqual({ error: "payload_too_large" });
  });

  it("returns 429 after the rate limit", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validPlan),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
    });

    const ip = "10.0.0.8";

    for (let i = 0; i < 20; i++) {
      const body = JSON.stringify({
        question: `Rate limit check ${i}`,
        profile: sampleProfile,
        samples: [],
      });
      const req = new Request("http://localhost/api/plan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": ip,
        },
        body,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    const reqBlocked = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({
        question: "Rate limit blocked 21st",
        profile: sampleProfile,
        samples: [],
      }),
    });

    const resBlocked = await POST(reqBlocked);
    expect(resBlocked.status).toBe(429);
    expect(resBlocked.headers.get("Retry-After")).toBeTruthy();
    expect(await resBlocked.json()).toEqual({ error: "rate_limited" });
  });

  it("the prompt never contains raw pii from the sample data", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(validPlan),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    });

    const orders = generateSampleOrders();
    const columns = Object.keys(orders[0]);
    const profile = profileRows(orders, columns);
    const maskedSamples = buildSamples(orders, profile, 5);

    const rawPhones = orders
      .map((o) => o.customer_phone)
      .filter((p) => typeof p === "string" && p.length > 0);

    const body = JSON.stringify({
      question: "PII check in prompt",
      profile,
      samples: maskedSamples,
    });

    const req = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.9",
      },
      body,
    });

    await POST(req);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents;

    for (const phone of rawPhones) {
      expect(promptText).not.toContain(phone);
    }
  });
});

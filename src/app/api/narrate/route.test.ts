import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StepResult } from "@/lib/engine/schemas";
import { verifyActions } from "@/lib/engine/verify";
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

const sampleResults: StepResult[] = [
  {
    stepId: "weekly_revenue",
    title: "Weekly revenue",
    kind: "trend",
    agg: "sum",
    column: "amount_inr",
    rows: [
      { label: "2026-08-03", value: 15400 },
      { label: "2026-08-10", value: 8200 },
      { label: "2026-08-17", value: 16100 },
    ],
    rowsUsed: 150,
    anomalies: [
      {
        label: "2026-08-10",
        value: 8200,
        expected: 15800,
        direction: "drop",
        score: -2.8,
      },
    ],
  },
  {
    stepId: "revenue_by_outlet",
    title: "Revenue by outlet",
    kind: "group",
    agg: "sum",
    column: "amount_inr",
    rows: [
      { label: "Baner", value: 24500 },
      { label: "Koregaon Park", value: 19200 },
      { label: "Viman Nagar", value: 12100 },
    ],
    rowsUsed: 150,
    anomalies: [],
  },
];

describe("POST /api/narrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(backoff, "sleep").mockResolvedValue();
    process.env.GEMINI_API_KEY = "test-key";
    resetRateLimits();
  });

  it("drops actions with invented numbers and tops up from fallback", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        actions: [
          {
            title: "Expand delivery in Baner",
            detail: "Baner delivered ₹24,500 in revenue this quarter.",
            evidence: [
              {
                stepId: "revenue_by_outlet",
                label: "Baner",
                value: 24500,
              },
            ],
          },
          {
            title: "Investigate mid-August drop",
            detail: "Revenue dropped to ₹8,200 during week of August 10.",
            evidence: [
              {
                stepId: "weekly_revenue",
                label: "2026-08-10",
                value: 8200,
              },
            ],
          },
          {
            title: "Cut untracked expense",
            detail: "Inventory loss was reported at ₹999,999 without records.",
            evidence: [
              {
                stepId: "weekly_revenue",
                label: "Invented Label",
                value: 999999,
              },
            ],
          },
        ],
      }),
      usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 80 },
    });

    const body = JSON.stringify({
      question: "What actions to take?",
      results: sampleResults,
    });

    const req = new Request("http://localhost/api/narrate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.1.0.1",
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.rejected).toBe(1);
    expect(data.actions).toHaveLength(3);

    const check = verifyActions(data.actions, sampleResults);
    expect(check.valid).toHaveLength(3);
    expect(check.rejected).toBe(0);
  });

  it("falls back when gemini is unavailable", async () => {
    delete process.env.GEMINI_API_KEY;

    const body = JSON.stringify({
      question: "Actions fallback question",
      results: sampleResults,
    });

    const req = new Request("http://localhost/api/narrate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.1.0.2",
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.meta.source).toBe("fallback");
    expect(data.meta.model).toBeNull();
    expect(data.actions.length).toBeGreaterThanOrEqual(1);

    const check = verifyActions(data.actions, sampleResults);
    expect(check.valid.length).toBe(data.actions.length);
  });
});

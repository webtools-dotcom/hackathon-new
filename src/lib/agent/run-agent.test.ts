import { afterEach, describe, it, expect, vi } from "vitest";
import { PlanResponseSchema } from "@/lib/server/contracts";
import {
  runAgent,
  defaultDeps,
  errorMessage,
  MAX_CSV_BYTES,
  type AgentDeps,
  type TraceEvent,
} from "./run-agent";
import {
  SAMPLE_CSV,
  SAMPLE_PLAN,
  generateSampleOrders,
} from "@/lib/sample-data";
import type { Plan } from "@/lib/engine/schemas";

describe("runAgent", () => {
  it("runs the full flow on sample data with a fake api", async () => {
    const fakeDeps: AgentDeps = {
      now: () => 1000,
      postJson: async (url, body, schema) => {
        if (url === "/api/plan") {
          const payload = {
            plan: SAMPLE_PLAN,
            meta: {
              source: "gemini" as const,
              model: "gemini-3.5-flash-lite",
              latencyMs: 120,
              attempts: 1,
              promptTokens: 250,
              outputTokens: 180,
              requestBytes: 400,
            },
          };
          return {
            ok: true as const,
            data: schema.parse(payload),
            bytes: 400,
          };
        }
        const payload = {
          actions: [
            {
              title: "Action 1",
              detail: "Detail for action 1",
              evidence: [
                { stepId: "revenue_total", label: "Total", value: 100 },
              ],
            },
            {
              title: "Action 2",
              detail: "Detail for action 2",
              evidence: [
                { stepId: "revenue_total", label: "Total", value: 100 },
              ],
            },
            {
              title: "Action 3",
              detail: "Detail for action 3",
              evidence: [
                { stepId: "revenue_total", label: "Total", value: 100 },
              ],
            },
          ],
          rejected: 0,
          meta: {
            source: "gemini" as const,
            model: "gemini-3.5-flash-lite",
            latencyMs: 150,
            attempts: 1,
            promptTokens: 300,
            outputTokens: 120,
            requestBytes: 500,
          },
        };
        return {
          ok: true as const,
          data: schema.parse(payload),
          bytes: 500,
        };
      },
    };

    const traces: TraceEvent[][] = [];
    const res = await runAgent(
      { csvText: SAMPLE_CSV, demo: true },
      fakeDeps,
      (t) => traces.push(t)
    );

    expect(res.results).toHaveLength(5);
    expect(res.actions).toHaveLength(3);
    const lastTrace = res.trace[res.trace.length - 1];
    expect(lastTrace.id).toBe("narrate");
    expect(lastTrace.status).toBe("done");
    const replanStep = res.trace.find((s) => s.id === "replan");
    expect(replanStep?.status).toBe("skipped");
  });

  it("never sends raw pii to any endpoint", async () => {
    const bodies: string[] = [];
    const fakeDeps: AgentDeps = {
      now: () => 1000,
      postJson: async (_url, body, schema) => {
        bodies.push(JSON.stringify(body));
        const payload = {
          plan: SAMPLE_PLAN,
          actions: [
            {
              title: "Action 1",
              detail: "Detail for action 1",
              evidence: [
                { stepId: "revenue_total", label: "Total", value: 1 },
              ],
            },
            {
              title: "Action 2",
              detail: "Detail for action 2",
              evidence: [
                { stepId: "revenue_total", label: "Total", value: 1 },
              ],
            },
            {
              title: "Action 3",
              detail: "Detail for action 3",
              evidence: [
                { stepId: "revenue_total", label: "Total", value: 1 },
              ],
            },
          ],
          rejected: 0,
          meta: {
            source: "gemini" as const,
            model: null,
            latencyMs: 10,
            attempts: 1,
            promptTokens: 10,
            outputTokens: 10,
            requestBytes: 10,
          },
        };
        return {
          ok: true as const,
          data: schema.parse(payload),
          bytes: 100,
        };
      },
    };

    await runAgent({ csvText: SAMPLE_CSV, demo: true }, fakeDeps, () => {});

    const sampleOrders = generateSampleOrders();
    const allPayloads = bodies.join(" ");

    for (const order of sampleOrders) {
      if (order.customer_name) {
        expect(allPayloads).not.toContain(order.customer_name);
      }
      if (order.customer_phone) {
        expect(allPayloads).not.toContain(order.customer_phone);
      }
    }
  });

  it("re-plans exactly once when a step fails", async () => {
    let planCalls = 0;
    const badPlan: Plan = {
      rationale: "Failing plan",
      steps: [
        {
          id: "step_missing",
          title: "Missing Column Step",
          kind: "total",
          agg: "sum",
          column: "non_existent_column",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [],
        },
      ],
    };

    const fakeDeps: AgentDeps = {
      now: () => 1000,
      postJson: async (url, body, schema) => {
        if (url === "/api/plan") {
          planCalls++;
          const payload = {
            plan: badPlan,
            meta: {
              source: "gemini" as const,
              model: null,
              latencyMs: 10,
              attempts: 1,
              promptTokens: 10,
              outputTokens: 10,
              requestBytes: 10,
            },
          };
          return {
            ok: true as const,
            data: schema.parse(payload),
            bytes: 100,
          };
        }
        const payload = {
          actions: [],
          rejected: 0,
          meta: {
            source: "gemini" as const,
            model: null,
            latencyMs: 10,
            attempts: 1,
            promptTokens: 10,
            outputTokens: 10,
            requestBytes: 10,
          },
        };
        return {
          ok: true as const,
          data: schema.parse(payload),
          bytes: 100,
        };
      },
    };

    await runAgent({ csvText: SAMPLE_CSV, demo: false }, fakeDeps, () => {});

    expect(planCalls).toBe(2);
  });

  it("falls back to the demo plan and rules-based actions when offline", async () => {
    const offlineDeps: AgentDeps = {
      now: () => 1000,
      postJson: async () => ({
        ok: false as const,
        status: 0,
        bytes: 0,
      }),
    };

    const res = await runAgent(
      { csvText: SAMPLE_CSV, demo: true },
      offlineDeps,
      () => {}
    );

    expect(res.metrics.sources).toEqual({
      plan: "demo",
      narrate: "fallback",
    });
    expect(res.actions).toHaveLength(3);
  });

  it("reports sentBytes far below rawBytes for sample data", async () => {
    const fakeDeps: AgentDeps = {
      now: () => 1000,
      postJson: async (url, body, schema) => {
        const payload = {
          plan: SAMPLE_PLAN,
          actions: [],
          rejected: 0,
          meta: {
            source: "gemini" as const,
            model: null,
            latencyMs: 10,
            attempts: 1,
            promptTokens: 10,
            outputTokens: 10,
            requestBytes: 500,
          },
        };
        return {
          ok: true as const,
          data: schema.parse(payload),
          bytes: 500,
        };
      },
    };

    const res = await runAgent(
      { csvText: SAMPLE_CSV, demo: true },
      fakeDeps,
      () => {}
    );

    expect(res.metrics.sentBytes).toBeLessThan(res.metrics.rawBytes);
  });

  it("rejects empty and oversized files with friendly codes", async () => {
    const fakeDeps: AgentDeps = {
      now: () => 1000,
      postJson: async () => ({ ok: false as const, status: 0, bytes: 0 }),
    };

    await expect(
      runAgent({ csvText: "", demo: false }, fakeDeps, () => {})
    ).rejects.toThrow("empty_file");

    const oversized = "a".repeat(MAX_CSV_BYTES + 1);
    await expect(
      runAgent({ csvText: oversized, demo: false }, fakeDeps, () => {})
    ).rejects.toThrow("file_too_large");

    expect(errorMessage("empty_file")).toBe(
      "We couldn't find any rows. Check that the first line has column names."
    );
    expect(errorMessage("file_too_large")).toBe(
      "That file is over 5 MB. Export a smaller date range."
    );
  });
});

describe("defaultDeps.postJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a response body that does not match the contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ plan: "not a plan" })));
    const res = await defaultDeps.postJson("/api/plan", { a: 1 }, PlanResponseSchema);
    expect(res).toEqual({ ok: false, status: 502, bytes: 7 });
  });

  it("reports network failures as status 0 instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    const res = await defaultDeps.postJson("/api/plan", {}, PlanResponseSchema);
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ status: 0 });
  });
});

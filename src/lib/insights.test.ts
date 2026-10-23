import { describe, expect, it } from "vitest";
import type { Anomaly, StepResult } from "@/lib/engine/schemas";
import { anomalyChangePct, describePeriod, formatPeriodLabel, pickHeadline } from "@/lib/insights";
import { generateSampleOrders, SAMPLE_PLAN } from "@/lib/sample-data";
import { profileRows } from "@/lib/engine/profile";
import { executePlan } from "@/lib/engine/execute";

const anomaly = (over: Partial<Anomaly> = {}): Anomaly => ({
  label: "2026-08-10", value: 3200, expected: 9300, direction: "drop", score: 4.2, ...over,
});

const result = (over: Partial<StepResult>): StepResult => ({
  stepId: "s", title: "T", kind: "group", agg: "sum", column: "amount_inr",
  rows: [], rowsUsed: 10, anomalies: [], ...over,
});

describe("formatPeriodLabel", () => {
  it("formats ISO dates as day and short month", () => {
    expect(formatPeriodLabel("2026-08-10")).toBe("10 Aug");
  });
  it("returns non-date labels unchanged", () => {
    expect(formatPeriodLabel("2026-08")).toBe("2026-08");
    expect(formatPeriodLabel("Baner")).toBe("Baner");
  });
});

describe("describePeriod", () => {
  it("names the bucket for each interval", () => {
    expect(describePeriod("2026-08-10", "week")).toBe("Week of 10 Aug");
    expect(describePeriod("2026-08-10", "day")).toBe("Day 10 Aug");
    expect(describePeriod("2026-08", "month")).toBe("Month 2026-08");
  });
});

describe("anomalyChangePct", () => {
  it("rounds the absolute change and guards a zero baseline", () => {
    expect(anomalyChangePct(anomaly())).toBe(66);
    expect(anomalyChangePct(anomaly({ expected: 0 }))).toBe(0);
  });
});

describe("pickHeadline", () => {
  it("prefers the highest-scoring anomaly across results", () => {
    const weak = result({ stepId: "a", kind: "trend", anomalies: [anomaly({ score: 3.6 })] });
    const strong = result({ stepId: "b", kind: "trend", anomalies: [anomaly({ score: 5.1 })] });
    const headline = pickHeadline([weak, strong]);
    expect(headline?.kind).toBe("anomaly");
    expect(headline?.result.stepId).toBe("b");
  });

  it("falls back to the leading group with its share of the total", () => {
    const group = result({ rows: [{ label: "Baner", value: 75 }, { label: "Viman Nagar", value: 25 }] });
    expect(pickHeadline([group])).toMatchObject({ kind: "leader", label: "Baner", sharePct: 75 });
  });

  it("returns null when there is nothing to headline", () => {
    expect(pickHeadline([result({ kind: "total", rows: [{ label: "Total", value: 1 }] })])).toBeNull();
  });

  it("headlines the planted August drop on the sample data", () => {
    const rows = generateSampleOrders().map((o) => ({ ...o }));
    const profile = profileRows(rows, Object.keys(rows[0]));
    const headline = pickHeadline(executePlan(SAMPLE_PLAN, rows, profile).results);
    expect(headline).toMatchObject({ kind: "anomaly", anomaly: { label: "2026-08-10", direction: "drop" } });
  });
});

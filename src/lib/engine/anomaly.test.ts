import { describe, expect, it } from "vitest";
import { detectAnomalies } from "./anomaly";
import { executePlan } from "./execute";
import { profileRows } from "./profile";
import { generateSampleOrders, SAMPLE_PLAN } from "../sample-data";
import type { ResultRow } from "./schemas";

describe("anomaly", () => {
  it("flags the planted drop week in sample data", () => {
    const orders = generateSampleOrders();
    const columns = Object.keys(orders[0]);
    const profile = profileRows(orders, columns);

    const { results } = executePlan(SAMPLE_PLAN, orders, profile);
    const weeklyRevenue = results.find((r) => r.stepId === "weekly_revenue");

    expect(weeklyRevenue?.anomalies).toBeDefined();
    expect(weeklyRevenue!.anomalies.length).toBeGreaterThan(0);
    expect(weeklyRevenue!.anomalies[0].label).toBe("2026-08-10");
    expect(weeklyRevenue!.anomalies[0].direction).toBe("drop");
  });

  it("ignores flat series and short series", () => {
    // Flat series: MAD is 0
    const flatSeries: ResultRow[] = Array.from({ length: 10 }, (_, i) => ({
      label: `2026-01-0${i + 1}`,
      value: 100,
    }));
    expect(detectAnomalies(flatSeries)).toEqual([]);

    // Short series: < 7 rows
    const shortSeries: ResultRow[] = [
      { label: "1", value: 10 },
      { label: "2", value: 10 },
      { label: "3", value: 1000 },
      { label: "4", value: 10 },
      { label: "5", value: 10 },
    ];
    expect(detectAnomalies(shortSeries)).toEqual([]);
  });

  it("never flags edge points", () => {
    // 8 points with huge spike at index 0 and index 7
    const seriesWithEdgeSpikes: ResultRow[] = [
      { label: "d0", value: 99999 }, // Index 0 (edge)
      { label: "d1", value: 100 },
      { label: "d2", value: 102 },
      { label: "d3", value: 98 },
      { label: "d4", value: 101 },
      { label: "d5", value: 99 },
      { label: "d6", value: 100 },
      { label: "d7", value: 99999 }, // Index 7 (edge)
    ];

    const anomalies = detectAnomalies(seriesWithEdgeSpikes);
    expect(anomalies).toEqual([]);
  });
});

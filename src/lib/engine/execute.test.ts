import { describe, expect, it } from "vitest";
import { executePlan } from "./execute";
import { profileRows } from "./profile";
import { generateSampleOrders, SAMPLE_PLAN } from "../sample-data";
import type { DatasetProfile, Plan, Row } from "./schemas";

describe("execute", () => {
  it("total sum matches a hand computed value", () => {
    const fixtureRows: Row[] = [
      { amount: "100.50", category: "Food" },
      { amount: "200.25", category: "Food" },
      { amount: "50", category: "Drink" },
      { amount: "150.25", category: "Drink" },
    ];
    const profile = profileRows(fixtureRows, ["amount", "category"]);

    const plan: Plan = {
      rationale: "Test hand-computed sum",
      steps: [
        {
          id: "total_amount",
          title: "Total Amount",
          kind: "total",
          agg: "sum",
          column: "amount",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [],
        },
      ],
    };

    const { results, failures } = executePlan(plan, fixtureRows, profile);
    expect(failures).toHaveLength(0);
    expect(results).toHaveLength(1);
    // 100.50 + 200.25 + 50 + 150.25 = 501.00
    expect(results[0].rows).toEqual([{ label: "Total", value: 501 }]);
  });

  it("group sorts desc and applies limit", () => {
    const fixtureRows: Row[] = [
      { item: "A", qty: "10" },
      { item: "B", qty: "30" },
      { item: "C", qty: "50" },
      { item: "D", qty: "20" },
    ];
    const profile = profileRows(fixtureRows, ["item", "qty"]);

    const plan: Plan = {
      rationale: "Test group sort and limit",
      steps: [
        {
          id: "top_2_items",
          title: "Top 2 items",
          kind: "group",
          agg: "sum",
          column: "qty",
          by: "item",
          dateColumn: null,
          interval: null,
          sort: "desc",
          limit: 2,
          filters: [],
        },
      ],
    };

    const { results, failures } = executePlan(plan, fixtureRows, profile);
    expect(failures).toHaveLength(0);
    expect(results[0].rows).toHaveLength(2);
    expect(results[0].rows[0]).toEqual({ label: "C", value: 50 });
    expect(results[0].rows[1]).toEqual({ label: "B", value: 30 });
  });

  it("filters with gt on numbers and eq case-insensitive", () => {
    const fixtureRows: Row[] = [
      { amount: "100", status: "Paid" },
      { amount: "300", status: "paid" },
      { amount: "500", status: "PENDING" },
      { amount: "200", status: "paid" },
    ];
    const profile = profileRows(fixtureRows, ["amount", "status"]);

    const plan: Plan = {
      rationale: "Test filtering",
      steps: [
        {
          id: "filtered_sum",
          title: "Filtered sum",
          kind: "total",
          agg: "sum",
          column: "amount",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [
            { column: "amount", op: "gt", value: 150 },
            { column: "status", op: "eq", value: "PAID" },
          ],
        },
      ],
    };

    const { results, failures } = executePlan(plan, fixtureRows, profile);
    expect(failures).toHaveLength(0);
    // Rows matching: amount=300 & status="paid", amount=200 & status="paid". Total = 500
    expect(results[0].rows).toEqual([{ label: "Total", value: 500 }]);
    expect(results[0].rowsUsed).toBe(2);
  });

  it("weekly trend uses Monday labels and fills empty weeks with 0", () => {
    const fixtureRows: Row[] = [
      { date: "2026-08-05", amount: "100" }, // Wednesday in week of Mon 2026-08-03
      // Gap week: Mon 2026-08-10 has no rows
      { date: "2026-08-18", amount: "200" }, // Tuesday in week of Mon 2026-08-17
    ];
    const profile = profileRows(fixtureRows, ["date", "amount"]);

    const plan: Plan = {
      rationale: "Test weekly trend gap fill",
      steps: [
        {
          id: "weekly_trend",
          title: "Weekly trend",
          kind: "trend",
          agg: "sum",
          column: "amount",
          by: null,
          dateColumn: "date",
          interval: "week",
          sort: null,
          limit: null,
          filters: [],
        },
      ],
    };

    const { results, failures } = executePlan(plan, fixtureRows, profile);
    expect(failures).toHaveLength(0);
    expect(results[0].rows).toEqual([
      { label: "2026-08-03", value: 100 },
      { label: "2026-08-10", value: 0 },
      { label: "2026-08-17", value: 200 },
    ]);
  });

  it("unknown column and empty result become failures not throws", () => {
    const fixtureRows: Row[] = [{ amount: "100" }];
    const profile = profileRows(fixtureRows, ["amount"]);

    const plan: Plan = {
      rationale: "Test failure handling",
      steps: [
        {
          id: "step_unknown",
          title: "Unknown column step",
          kind: "total",
          agg: "sum",
          column: "ghost_column",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [],
        },
        {
          id: "step_empty",
          title: "Filter to empty",
          kind: "total",
          agg: "sum",
          column: "amount",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [{ column: "amount", op: "gt", value: 9999 }],
        },
      ],
    };

    expect(() => {
      const { failures } = executePlan(plan, fixtureRows, profile);
      expect(failures).toEqual([
        { stepId: "step_unknown", reason: "unknown_column" },
        { stepId: "step_empty", reason: "empty_result" },
      ]);
    }).not.toThrow();
  });

  it("__proto__ as a group value is handled safely", () => {
    const fixtureRows: Row[] = [
      { key: "__proto__", val: "50" },
      { key: "normal", val: "20" },
    ];
    const profile: DatasetProfile = {
      rowCount: 2,
      columns: [
        {
          name: "key",
          kind: "category",
          piiType: null,
          distinct: 2,
          missing: 0,
          min: null,
          max: null,
          topValues: ["__proto__", "normal"],
        },
        {
          name: "val",
          kind: "number",
          piiType: null,
          distinct: 2,
          missing: 0,
          min: 20,
          max: 50,
          topValues: [],
        },
      ],
    };

    const plan: Plan = {
      rationale: "Prototype pollution test",
      steps: [
        {
          id: "group_proto",
          title: "Group by proto",
          kind: "group",
          agg: "sum",
          column: "val",
          by: "key",
          dateColumn: null,
          interval: null,
          sort: "desc",
          limit: 10,
          filters: [],
        },
      ],
    };

    const { results } = executePlan(plan, fixtureRows, profile);
    const labels = results[0].rows.map((r) => r.label);
    expect(labels).toContain("__proto__");
    // Verify Object.prototype was not polluted
    expect((Object.prototype as Record<string, unknown>)["sum"]).toBeUndefined();
  });

  it("SAMPLE_PLAN on sample data has no failures", () => {
    const orders = generateSampleOrders();
    const columns = Object.keys(orders[0]);
    const profile = profileRows(orders, columns);

    const { results, failures } = executePlan(SAMPLE_PLAN, orders, profile);
    expect(failures).toHaveLength(0);
    expect(results).toHaveLength(5);

    const weeklyRevenue = results.find((r) => r.stepId === "weekly_revenue");
    expect(weeklyRevenue?.rows).toHaveLength(13);
  });
});

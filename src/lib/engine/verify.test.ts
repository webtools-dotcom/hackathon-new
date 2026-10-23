import { describe, expect, it } from "vitest";
import { verifyActions } from "./verify";
import type { Action, StepResult } from "./schemas";

describe("verify", () => {
  const dummyResults: StepResult[] = [
    {
      stepId: "revenue_total",
      title: "Total revenue",
      kind: "total",
      agg: "sum",
      column: "amount_inr",
      rows: [{ label: "Total", value: 50000 }],
      rowsUsed: 100,
      anomalies: [],
    },
    {
      stepId: "weekly_revenue",
      title: "Weekly revenue",
      kind: "trend",
      agg: "sum",
      column: "amount_inr",
      rows: [
        { label: "2026-08-03", value: 12000 },
        { label: "2026-08-10", value: 4500 },
      ],
      rowsUsed: 100,
      anomalies: [
        {
          label: "2026-08-10",
          value: 4500,
          expected: 11000,
          direction: "drop",
          score: 4.2,
        },
      ],
    },
  ];

  it("accepts evidence that matches results", () => {
    const actions: Action[] = [
      {
        title: "Investigate low week",
        detail: "Revenue dropped significantly in week 2026-08-10.",
        evidence: [
          {
            stepId: "weekly_revenue",
            label: "2026-08-10",
            value: 4500,
          },
        ],
      },
      {
        title: "Overall growth",
        detail: "Total revenue reached ₹50,000 across outlets.",
        evidence: [
          {
            stepId: "revenue_total",
            label: "Total",
            value: 50000,
          },
        ],
      },
    ];

    const { valid, rejected } = verifyActions(actions, dummyResults);
    expect(valid).toHaveLength(2);
    expect(rejected).toBe(0);
  });

  it("rejects invented numbers", () => {
    const actions: Action[] = [
      {
        title: "Fake revenue claim",
        detail: "Total revenue was supposedly ₹55,000 (10% higher).",
        evidence: [
          {
            stepId: "revenue_total",
            label: "Total",
            value: 55000, // 55,000 vs real 50,000 (off by 10%)
          },
        ],
      },
    ];

    const { valid, rejected } = verifyActions(actions, dummyResults);
    expect(valid).toHaveLength(0);
    expect(rejected).toBe(1);
  });
});

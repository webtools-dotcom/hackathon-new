import { describe, expect, it } from "vitest";
import { sanitizePlan, validatePlan } from "./validate";
import { profileRows } from "./profile";
import { generateSampleOrders, SAMPLE_PLAN } from "../sample-data";
import type { Plan } from "./schemas";

describe("validate", () => {
  const orders = generateSampleOrders();
  const profile = profileRows(orders, Object.keys(orders[0]));

  it("SAMPLE_PLAN is valid for the sample profile", () => {
    const issues = validatePlan(SAMPLE_PLAN, profile);
    expect(issues).toEqual([]);
  });

  it("rejects unknown and pii columns", () => {
    const badPlan: Plan = {
      rationale: "Testing invalid columns",
      steps: [
        {
          id: "step_unknown",
          title: "Unknown column",
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
        {
          id: "step_pii",
          title: "PII column in group",
          kind: "group",
          agg: "count",
          column: null,
          by: "customer_name",
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [],
        },
      ],
    };

    const issues = validatePlan(badPlan, profile);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("unknown_column");
    expect(codes).toContain("pii_column");
  });

  it("rejects sum over a category column", () => {
    const badPlan: Plan = {
      rationale: "Sum on category",
      steps: [
        {
          id: "bad_sum",
          title: "Sum category",
          kind: "total",
          agg: "sum",
          column: "outlet",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [],
        },
      ],
    };

    const issues = validatePlan(badPlan, profile);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("wrong_column_kind");
  });

  it("sanitizePlan drops bad steps and returns null when none remain", () => {
    const partiallyBadPlan: Plan = {
      rationale: "Mixed plan",
      steps: [
        {
          id: "good_step",
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
          id: "bad_step",
          title: "Invalid step",
          kind: "total",
          agg: "sum",
          column: "non_existent",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [],
        },
      ],
    };

    const sanitized = sanitizePlan(partiallyBadPlan, profile);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.steps).toHaveLength(1);
    expect(sanitized?.steps[0].id).toBe("good_step");

    const completelyBadPlan: Plan = {
      rationale: "All bad",
      steps: [
        {
          id: "bad_1",
          title: "Invalid step",
          kind: "total",
          agg: "sum",
          column: "non_existent",
          by: null,
          dateColumn: null,
          interval: null,
          sort: null,
          limit: null,
          filters: [],
        },
      ],
    };

    expect(sanitizePlan(completelyBadPlan, profile)).toBeNull();
  });
});

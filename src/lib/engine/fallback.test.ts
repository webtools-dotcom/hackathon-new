import { describe, expect, it } from "vitest";
import { buildFallbackActions, buildFallbackPlan } from "./fallback";
import { validatePlan } from "./validate";
import { verifyActions } from "./verify";
import { executePlan } from "./execute";
import { profileRows } from "./profile";
import { generateSampleOrders, SAMPLE_PLAN } from "../sample-data";

describe("fallback", () => {
  const orders = generateSampleOrders();
  const profile = profileRows(orders, Object.keys(orders[0]));

  it("fallback plan is valid for the sample profile", () => {
    const fallbackPlan = buildFallbackPlan(profile);
    expect(fallbackPlan).not.toBeNull();
    const issues = validatePlan(fallbackPlan!, profile);
    expect(issues).toEqual([]);
  });

  it("fallback actions pass verification", () => {
    const { results } = executePlan(SAMPLE_PLAN, orders, profile);
    const actions = buildFallbackActions(results);

    expect(actions).toHaveLength(3);
    const { valid, rejected } = verifyActions(actions, results);
    expect(rejected).toBe(0);
    expect(valid).toHaveLength(3);
  });
});

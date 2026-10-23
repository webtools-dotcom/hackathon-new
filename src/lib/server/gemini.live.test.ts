import { describe, expect, it } from "vitest";
import { buildSamples } from "@/lib/engine/mask";
import { profileRows } from "@/lib/engine/profile";
import { PlanSchema } from "@/lib/engine/schemas";
import { validatePlan } from "@/lib/engine/validate";
import { generateSampleOrders } from "@/lib/sample-data";
import { generateJson } from "./gemini";
import { PLAN_SYSTEM, planPrompt } from "./prompts";

describe.skipIf(!process.env.GEMINI_API_KEY)("gemini live", () => {
  it(
    "generates a valid plan using gemini without pii columns",
    async () => {
      const orders = generateSampleOrders();
      const columns = Object.keys(orders[0]);
      const profile = profileRows(orders, columns);
      const samples = buildSamples(orders, profile, 5);

      const prompt = planPrompt({
        profile,
        samples,
        question: "Overview of restaurant performance",
      });

      const result = await generateJson({
        system: PLAN_SYSTEM,
        prompt,
        schema: PlanSchema,
      });

      expect(result.data.steps.length).toBeGreaterThanOrEqual(1);
      // Verify model and steps
      expect(result.model).toBe(process.env.GEMINI_MODEL || "gemini-3.5-flash-lite");

      const issues = validatePlan(result.data, profile);
      const piiIssues = issues.filter((i) => i.code === "pii_column");
      expect(piiIssues).toHaveLength(0);
    },
    60_000
  );
});

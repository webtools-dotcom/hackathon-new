import { describe, expect, it } from "vitest";
import { buildSamples, maskRow, scrubText } from "./mask";
import { profileRows } from "./profile";
import { generateSampleOrders } from "../sample-data";

describe("mask", () => {
  it("maskRow replaces pii values", () => {
    const profile = {
      rowCount: 1,
      columns: [
        {
          name: "customer_name",
          kind: "pii" as const,
          piiType: "name" as const,
          distinct: 1,
          missing: 0,
          min: null,
          max: null,
          topValues: [],
        },
        {
          name: "customer_phone",
          kind: "pii" as const,
          piiType: "phone" as const,
          distinct: 1,
          missing: 0,
          min: null,
          max: null,
          topValues: [],
        },
      ],
    };

    const masked = maskRow(
      { customer_name: "Aarav Kulkarni", customer_phone: "+91 98123 45678" },
      profile
    );

    expect(masked.customer_name).toBe("[name]");
    expect(masked.customer_phone).toBe("[phone]");
  });

  it("scrubText removes emails and phones from free text", () => {
    const input = "call 98765 43210 or a@b.in";
    const scrubbed = scrubText(input);
    expect(scrubbed).not.toContain("98765 43210");
    expect(scrubbed).not.toContain("a@b.in");
    expect(scrubbed).toContain("[phone]");
    expect(scrubbed).toContain("[email]");
  });

  it("buildSamples returns at most 5 masked rows and does not mutate input", () => {
    const orders = generateSampleOrders();
    const columns = Object.keys(orders[0]);
    const profile = profileRows(orders, columns);

    const originalJson = JSON.stringify(orders);
    const samples = buildSamples(orders, profile, 5);

    expect(samples.length).toBeLessThanOrEqual(5);
    expect(samples.length).toBe(5);

    const samplesJson = JSON.stringify(samples);
    expect(samplesJson).not.toContain(orders[0].customer_name);
    expect(samplesJson).not.toContain(orders[0].customer_phone);

    expect(JSON.stringify(orders)).toBe(originalJson);
  });
});

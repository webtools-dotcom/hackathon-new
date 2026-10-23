import { describe, it, expect } from "vitest";
import { formatValue } from "./format";

describe("formatValue", () => {
  it("formatValue uses rupees for money columns", () => {
    const formatted = formatValue(125000, "amount_inr");
    expect(formatted).toMatch(/₹|Rs/);
    expect(formatted).toContain("1,25,000");

    expect(formatValue(500, "revenue")).toMatch(/₹|Rs/);
    expect(formatValue(500, "price")).toMatch(/₹|Rs/);
    expect(formatValue(500, "total")).toMatch(/₹|Rs/);
    expect(formatValue(500, "sales")).toMatch(/₹|Rs/);
    expect(formatValue(500, "inr")).toMatch(/₹|Rs/);
  });

  it("formats non-money columns with en-IN numbering", () => {
    expect(formatValue(125000, "qty")).toBe("1,25,000");
    expect(formatValue(125000, null)).toBe("1,25,000");
  });
});

import { describe, expect, it } from "vitest";
import {
  detectPii,
  parseDate,
  parseNumber,
  profileRows,
} from "./profile";
import { generateSampleOrders } from "../sample-data";

describe("profile", () => {
  it("parseNumber handles rupee symbols and commas", () => {
    expect(parseNumber("₹1,250.50")).toBe(1250.5);
    expect(parseNumber("Rs 300")).toBe(300);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });

  it("parseDate accepts three formats and rejects impossible dates", () => {
    expect(parseDate("2026-08-10")).toBe("2026-08-10");
    expect(parseDate("10-08-2026")).toBe("2026-08-10");
    expect(parseDate("10/08/2026")).toBe("2026-08-10");
    expect(parseDate("2026-02-30")).toBeNull();
  });

  it("detectPii flags customer and phone columns but not item_name", () => {
    expect(detectPii("customer_name", [])).toBe("name");
    expect(detectPii("phone", [])).toBe("phone");
    expect(detectPii("item_name", [])).toBeNull();
  });

  it("detectPii flags email values in an unnamed column", () => {
    const values = [
      "user1@example.com",
      "user2@example.in",
      "not-an-email",
      "user3@spice.org",
    ];
    expect(detectPii("c1", values)).toBe("email");
  });

  it("profileRows infers kinds for sample data", () => {
    const orders = generateSampleOrders();
    const columns = Object.keys(orders[0]);
    const profile = profileRows(orders, columns);

    const kindMap = new Map(profile.columns.map((c) => [c.name, c.kind]));
    expect(kindMap.get("amount_inr")).toBe("number");
    expect(kindMap.get("date")).toBe("date");
    expect(kindMap.get("outlet")).toBe("category");
    expect(kindMap.get("customer_name")).toBe("pii");
    expect(kindMap.get("customer_phone")).toBe("pii");
  });

  it("profileRows computes min max and topValues", () => {
    const orders = generateSampleOrders();
    const columns = Object.keys(orders[0]);
    const profile = profileRows(orders, columns);

    const amountCol = profile.columns.find((c) => c.name === "amount_inr");
    expect(amountCol?.min).toBeTypeOf("number");
    expect((amountCol?.min as number) > 0).toBe(true);

    const dateCol = profile.columns.find((c) => c.name === "date");
    expect(dateCol?.min).toBe("2026-07-06");
    expect(dateCol?.max).toBe("2026-10-04");

    const outletCol = profile.columns.find((c) => c.name === "outlet");
    expect(outletCol?.topValues).toHaveLength(3);
  });

  it("profileRows rejects more than 40 columns", () => {
    const dummyCols = Array.from({ length: 41 }, (_, i) => `col_${i}`);
    expect(() => profileRows([], dummyCols)).toThrow("too_many_columns");
  });
});

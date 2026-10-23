import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("px-2", false && "hidden", "py-1")).toBe("px-2 py-1");
  });
});

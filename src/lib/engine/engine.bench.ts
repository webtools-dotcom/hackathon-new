import { describe, it } from "vitest";
import Papa from "papaparse";
import type { Row } from "./schemas";
import { profileRows } from "./profile";
import { executePlan } from "./execute";
import { SAMPLE_CSV, SAMPLE_PLAN } from "@/lib/sample-data";

const parsed = Papa.parse<Row>(SAMPLE_CSV, {
  header: true,
  skipEmptyLines: true,
});
const sampleRows = parsed.data;
const fields = parsed.meta.fields ?? [];
const sampleProfile = profileRows(sampleRows, fields);

const bigRows: Row[] = [];
while (bigRows.length < 20000) {
  for (const r of sampleRows) {
    if (bigRows.length >= 20000) break;
    bigRows.push(r);
  }
}
const bigProfile = profileRows(bigRows, fields);

describe("sample data", () => {
  it("profileRows", async ({ bench }) => {
    await bench("profileRows", () => {
      profileRows(sampleRows, fields);
    }).run();
  });

  it("executePlan(SAMPLE_PLAN)", async ({ bench }) => {
    await bench("executePlan(SAMPLE_PLAN)", () => {
      executePlan(SAMPLE_PLAN, sampleRows, sampleProfile);
    }).run();
  });
});

describe("20 000 rows", () => {
  it("profileRows", async ({ bench }) => {
    await bench("profileRows", () => {
      profileRows(bigRows, fields);
    }).run();
  });

  it("executePlan(SAMPLE_PLAN)", async ({ bench }) => {
    await bench("executePlan(SAMPLE_PLAN)", () => {
      executePlan(SAMPLE_PLAN, bigRows, bigProfile);
    }).run();
  });
});

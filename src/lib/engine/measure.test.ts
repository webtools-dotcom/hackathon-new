import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import type { Row } from "./schemas";
import { profileRows } from "./profile";
import { buildSamples } from "./mask";
import { executePlan } from "./execute";
import { SAMPLE_CSV, SAMPLE_PLAN } from "@/lib/sample-data";

describe("measurements", () => {
  it("model payloads are a small fraction of the raw file and contain no pii", () => {
    const encoder = new TextEncoder();
    const rawBytes = encoder.encode(SAMPLE_CSV).length;

    const parsed = Papa.parse<Row>(SAMPLE_CSV, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parsed.data;
    const fields = parsed.meta.fields ?? [];
    const profile = profileRows(rows, fields);
    const samples = buildSamples(rows, profile);

    const planPayload = { profile, samples };
    const planJson = JSON.stringify(planPayload);
    const planBytes = encoder.encode(planJson).length;

    const execOutput = executePlan(SAMPLE_PLAN, rows, profile);
    const sanitizedResults = execOutput.results.map((r) => {
      let rRows = r.rows;
      if (r.kind === "trend" && rRows.length > 60) {
        rRows = rRows.slice(-60);
      }
      return {
        ...r,
        rows: rRows.map((row) => ({
          label: row.label.slice(0, 64),
          value: row.value,
        })),
      };
    });

    const narratePayload = {
      results: sanitizedResults,
    };
    const narrateJson = JSON.stringify(narratePayload);
    const narrateBytes = encoder.encode(narrateJson).length;

    // Assert payloads are < 25% of raw bytes
    expect(planBytes + narrateBytes).toBeLessThan(rawBytes * 0.25);

    // Assert that the bodies contain no raw customer_phone / customer_name values
    for (const row of rows) {
      if (row.customer_phone && row.customer_phone.trim() !== "") {
        expect(planJson).not.toContain(row.customer_phone);
        expect(narrateJson).not.toContain(row.customer_phone);
      }
      if (row.customer_name && row.customer_name.trim() !== "") {
        expect(planJson).not.toContain(row.customer_name);
        expect(narrateJson).not.toContain(row.customer_name);
      }
    }

    const ratio = Number(((planBytes + narrateBytes) / rawBytes).toFixed(4));
    const results = {
      rawBytes,
      planBytes,
      narrateBytes,
      ratio,
      rowCount: rows.length,
      generatedBy: "src/lib/engine/measure.test.ts",
    };

    const outDir = resolve(process.cwd(), "bench");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      resolve(outDir, "results.json"),
      JSON.stringify(results, null, 2) + "\n"
    );
  });
});

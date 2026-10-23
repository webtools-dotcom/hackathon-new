import { ArrowDown, Lock, Sparkles } from "lucide-react";
import { generateSampleOrders } from "@/lib/sample-data";
import { profileRows } from "@/lib/engine/profile";
import { maskRow } from "@/lib/engine/mask";
import type { Row } from "@/lib/engine/schemas";
import measured from "../../../bench/results.json";

const COLUMNS = ["customer_name", "customer_phone", "outlet", "amount_inr"] as const;

// Real engine output on the sample dataset, not a mock-up.
const allRows: Row[] = generateSampleOrders().map((o) => ({ ...o }));
const profile = profileRows(allRows, Object.keys(allRows[0] ?? {}));
const rawPreview = allRows.slice(0, 3);
const maskedPreview = rawPreview.map((r) => maskRow(r, profile));
const sentPct = Math.round(
  ((measured.planBytes + measured.narrateBytes) / measured.rawBytes) * 100
);

function MiniTable({ rows, masked }: { rows: Row[]; masked: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-[11px] leading-5">
        <thead className="text-muted-foreground">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap pr-3 font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {COLUMNS.map((c) => {
                const pii = c.startsWith("customer");
                return (
                  <td key={c} className="whitespace-nowrap pr-3">
                    <span
                      className={
                        pii && masked
                          ? "rounded bg-primary/10 px-1 text-primary"
                          : pii
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      {r[c]}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrivacyPreview() {
  return (
    <section
      aria-labelledby="privacy-preview-title"
      className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="privacy-preview-title" className="text-sm font-semibold">
          What leaves your browser
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Masked on device
        </span>
      </div>

      <div className="mt-4 rounded-xl border bg-background p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Your file · {measured.rowCount} rows
        </p>
        <MiniTable rows={rawPreview} masked={false} />
      </div>

      <div className="flex justify-center py-2 text-muted-foreground" aria-hidden="true">
        <ArrowDown className="h-4 w-4" />
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Sent to Gemini · masked samples
        </p>
        <MiniTable rows={maskedPreview} masked />
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x rounded-xl border text-center">
        <div className="p-3">
          <dt className="text-[11px] text-muted-foreground">Raw rows sent</dt>
          <dd className="text-xl font-semibold tabular-nums">0</dd>
        </div>
        <div className="p-3">
          <dt className="text-[11px] text-muted-foreground">Of file size</dt>
          <dd className="text-xl font-semibold tabular-nums">{sentPct}%</dd>
        </div>
        <div className="p-3">
          <dt className="text-[11px] text-muted-foreground">Numbers by model</dt>
          <dd className="text-xl font-semibold tabular-nums">0</dd>
        </div>
      </dl>
    </section>
  );
}

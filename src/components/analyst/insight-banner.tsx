import { TrendingDown, TrendingUp, Trophy } from "lucide-react";
import type { StepResult } from "@/lib/engine/schemas";
import { formatValue } from "@/lib/format";

function periodLabel(label: string): string {
  const d = new Date(`${label}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return label;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** The single most important finding, stated in one sentence above the charts. */
export function InsightBanner({ results }: { results: StepResult[] }) {
  const anomalyStep = results
    .filter((r) => r.anomalies.length > 0)
    .sort((a, b) => b.anomalies[0].score - a.anomalies[0].score)[0];

  if (anomalyStep) {
    const a = anomalyStep.anomalies[0];
    const pct = a.expected === 0 ? 0 : Math.round((Math.abs(a.value - a.expected) / a.expected) * 100);
    const Icon = a.direction === "drop" ? TrendingDown : TrendingUp;
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <Icon className="mt-1 h-6 w-6 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-destructive">Biggest change found</p>
          <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {anomalyStep.title} {a.direction === "drop" ? "fell" : "jumped"} {pct}% around {periodLabel(a.label)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatValue(a.value, anomalyStep.column)} against a typical{" "}
            {formatValue(a.expected, anomalyStep.column)}. Flagged by a robust z-score of {a.score}, computed in your browser.
          </p>
        </div>
      </div>
    );
  }

  const group = results.find((r) => r.kind === "group" && r.rows.length >= 2);
  if (!group) return null;
  const total = group.rows.reduce((s, r) => s + r.value, 0);
  const top = group.rows[0];
  const share = total === 0 ? 0 : Math.round((top.value / total) * 100);
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <Trophy className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Biggest driver</p>
        <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          {top.label} leads {group.title.toLowerCase()} with {share}% of the total
        </p>
      </div>
    </div>
  );
}

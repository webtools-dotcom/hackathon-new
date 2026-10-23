import { TrendingDown, TrendingUp, Trophy } from "lucide-react";
import type { StepResult } from "@/lib/engine/schemas";
import { formatValue } from "@/lib/format";
import { formatPeriodLabel, pickHeadline } from "@/lib/insights";

/** The single most important finding, stated in one sentence above the charts. */
export function InsightBanner({ results }: { results: StepResult[] }) {
  const headline = pickHeadline(results);
  if (!headline) return null;

  if (headline.kind === "anomaly") {
    const { result, anomaly, changePct } = headline;
    const Icon = anomaly.direction === "drop" ? TrendingDown : TrendingUp;
    return (
      <section
        aria-labelledby="headline-title"
        className="flex items-start gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
      >
        <Icon className="mt-1 h-6 w-6 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-destructive">
            Biggest change found
          </p>
          <h2 id="headline-title" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {result.title} {anomaly.direction === "drop" ? "fell" : "jumped"} {changePct}% around{" "}
            {formatPeriodLabel(anomaly.label)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatValue(anomaly.value, result.column)} against a typical{" "}
            {formatValue(anomaly.expected, result.column)}. Flagged by a robust z-score of{" "}
            {anomaly.score}, computed in your browser.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="headline-title"
      className="flex items-start gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5"
    >
      <Trophy className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Biggest driver</p>
        <h2 id="headline-title" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          {headline.label} leads {headline.result.title.toLowerCase()} with {headline.sharePct}% of
          the total
        </h2>
      </div>
    </section>
  );
}

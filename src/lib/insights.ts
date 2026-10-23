/**
 * Presentation helpers that turn engine results into human-readable findings.
 * Pure functions, shared by the charts and the headline banner.
 */
import type { Anomaly, Step, StepResult } from "@/lib/engine/schemas";

type Interval = NonNullable<Step["interval"]>;

/** "2026-08-10" -> "10 Aug"; non-ISO labels are returned unchanged. */
export function formatPeriodLabel(label: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
  if (!match) return label;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Names a trend bucket for its interval, e.g. "Week of 10 Aug". */
export function describePeriod(label: string, interval: Interval | null): string {
  if (interval === "month") return `Month ${label}`;
  if (interval === "day") return `Day ${formatPeriodLabel(label)}`;
  return `Week of ${formatPeriodLabel(label)}`;
}

/** Absolute % difference from the expected value, rounded; 0 when expected is 0. */
export function anomalyChangePct(anomaly: Anomaly): number {
  if (anomaly.expected === 0) return 0;
  return Math.round((Math.abs(anomaly.value - anomaly.expected) / anomaly.expected) * 100);
}

export type Headline =
  | { kind: "anomaly"; result: StepResult; anomaly: Anomaly; changePct: number }
  | { kind: "leader"; result: StepResult; label: string; sharePct: number };

/**
 * The single most important finding: the strongest anomaly across all trends,
 * otherwise the leading bucket of the first grouping. Null when neither exists.
 */
export function pickHeadline(results: StepResult[]): Headline | null {
  let best: { result: StepResult; anomaly: Anomaly } | null = null;
  for (const result of results) {
    for (const anomaly of result.anomalies) {
      if (!best || anomaly.score > best.anomaly.score) best = { result, anomaly };
    }
  }
  if (best) return { kind: "anomaly", ...best, changePct: anomalyChangePct(best.anomaly) };

  const group = results.find((r) => r.kind === "group" && r.rows.length >= 2);
  if (!group) return null;
  const total = group.rows.reduce((sum, row) => sum + row.value, 0);
  const top = group.rows[0];
  const sharePct = total === 0 ? 0 : Math.round((top.value / total) * 100);
  return { kind: "leader", result: group, label: top.label, sharePct };
}

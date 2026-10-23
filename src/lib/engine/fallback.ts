import type {
  Action,
  DatasetProfile,
  Plan,
  Step,
  StepResult,
} from "./schemas";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 24);
}

export function buildFallbackPlan(profile: DatasetProfile): Plan | null {
  const numCol = profile.columns.find((c) => c.kind === "number")?.name ?? null;
  const catCol = profile.columns.find((c) => c.kind === "category")?.name ?? null;
  const dateCol = profile.columns.find((c) => c.kind === "date")?.name ?? null;

  const steps: Step[] = [];

  // Step 1: total
  if (numCol) {
    steps.push({
      id: "total_value",
      title: `Total ${numCol}`,
      kind: "total",
      agg: "sum",
      column: numCol,
      by: null,
      dateColumn: null,
      interval: null,
      sort: null,
      limit: null,
      filters: [],
    });
  } else {
    steps.push({
      id: "total_rows",
      title: "Total records",
      kind: "total",
      agg: "count",
      column: null,
      by: null,
      dateColumn: null,
      interval: null,
      sort: null,
      limit: null,
      filters: [],
    });
  }

  // Step 2: group if C exists
  if (catCol) {
    steps.push({
      id: `by_${slug(catCol)}`,
      title: `${numCol ? numCol : "Records"} by ${catCol}`,
      kind: "group",
      agg: numCol ? "sum" : "count",
      column: numCol ?? null,
      by: catCol,
      dateColumn: null,
      interval: null,
      sort: "desc",
      limit: 10,
      filters: [],
    });
  }

  // Step 3: trend if D exists
  if (dateCol) {
    steps.push({
      id: "weekly_trend",
      title: `Weekly ${numCol ? numCol : "records"}`,
      kind: "trend",
      agg: numCol ? "sum" : "count",
      column: numCol ?? null,
      by: null,
      dateColumn: dateCol,
      interval: "week",
      sort: null,
      limit: null,
      filters: [],
    });
  }

  if (steps.length === 0) {
    return null;
  }

  return {
    rationale: "Rules-based plan (model unavailable).",
    steps,
  };
}

export function buildFallbackActions(results: StepResult[]): Action[] {
  const actions: Action[] = [];

  // 1. First trend step with an anomaly
  const trendWithAnomaly = results.find(
    (r) => r.kind === "trend" && r.anomalies && r.anomalies.length > 0
  );
  if (trendWithAnomaly) {
    const anomaly = trendWithAnomaly.anomalies[0];
    const diff = Math.abs(anomaly.value - anomaly.expected);
    const pct =
      anomaly.expected > 0
        ? Math.round((diff / anomaly.expected) * 100)
        : 0;
    const directionWord = anomaly.direction === "drop" ? "lower" : "higher";
    const valFormatted = anomaly.value.toLocaleString("en-IN");
    const expFormatted = anomaly.expected.toLocaleString("en-IN");

    actions.push({
      title: `Investigate ${anomaly.label}`,
      detail: `${trendWithAnomaly.title} was ${valFormatted} against a typical ${expFormatted} (${pct}% ${directionWord}). Check what changed that period.`,
      evidence: [
        {
          stepId: trendWithAnomaly.stepId,
          label: anomaly.label,
          value: anomaly.value,
        },
      ],
    });
  }

  // 2 & 3: First group step with >= 2 rows
  const groupStep = results.find(
    (r) => r.kind === "group" && r.rows && r.rows.length >= 2
  );
  if (groupStep) {
    const topRow = groupStep.rows[0];
    const total = groupStep.rows.reduce((sum, r) => sum + r.value, 0);
    const sharePct =
      total > 0 ? Math.round((topRow.value / total) * 100) : 0;
    const topFormatted = topRow.value.toLocaleString("en-IN");

    actions.push({
      title: `Double down on ${topRow.label}`,
      detail: `${topRow.label} generated ${topFormatted}, representing ${sharePct}% of ${groupStep.title.toLowerCase()}.`,
      evidence: [
        {
          stepId: groupStep.stepId,
          label: topRow.label,
          value: topRow.value,
        },
      ],
    });

    const bottomRow = groupStep.rows[groupStep.rows.length - 1];
    const bottomFormatted = bottomRow.value.toLocaleString("en-IN");

    actions.push({
      title: `Review ${bottomRow.label}`,
      detail: `${bottomRow.label} accounted for ${bottomFormatted} in ${groupStep.title.toLowerCase()}. Review underperforming segments.`,
      evidence: [
        {
          stepId: groupStep.stepId,
          label: bottomRow.label,
          value: bottomRow.value,
        },
      ],
    });
  }

  return actions;
}

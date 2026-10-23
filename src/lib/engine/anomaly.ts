import type { Anomaly, ResultRow } from "./schemas";

function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectAnomalies(
  rows: ResultRow[],
  threshold = 3.5
): Anomaly[] {
  if (rows.length < 7) {
    return [];
  }

  const values = rows.map((r) => r.value);
  const m = computeMedian(values);
  const absDevs = values.map((v) => Math.abs(v - m));
  const mad = computeMedian(absDevs);

  if (mad === 0) {
    return [];
  }

  const anomalies: Anomaly[] = [];

  // Never flag the first or the last row (partial periods at the edges)
  for (let i = 1; i < rows.length - 1; i++) {
    const row = rows[i];
    const scoreRaw = Math.abs(row.value - m) / (1.4826 * mad);

    if (scoreRaw > threshold) {
      anomalies.push({
        label: row.label,
        value: row.value,
        expected: Math.round(m * 100) / 100,
        direction: row.value > m ? "spike" : "drop",
        score: Math.round(scoreRaw * 10) / 10,
      });
    }
  }

  anomalies.sort((a, b) => b.score - a.score);
  return anomalies.slice(0, 3);
}

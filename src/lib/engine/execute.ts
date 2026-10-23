import type {
  Anomaly,
  DatasetProfile,
  ExecutionOutput,
  Plan,
  ResultRow,
  Row,
  StepFailure,
  StepResult,
} from "./schemas";
import { parseDate, parseNumber } from "./profile";
import { detectAnomalies } from "./anomaly";

export function bucketLabel(
  isoDate: string,
  interval: "day" | "week" | "month"
): string {
  if (interval === "day") {
    return isoDate;
  }
  if (interval === "month") {
    return isoDate.slice(0, 7);
  }

  // ISO week Monday calculation (UTC math only)
  const parts = isoDate.split("-");
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);

  const wy = dt.getUTCFullYear();
  const wm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const wd = String(dt.getUTCDate()).padStart(2, "0");
  return `${wy}-${wm}-${wd}`;
}

export function executePlan(
  plan: Plan,
  rows: Row[],
  profile: DatasetProfile
): ExecutionOutput {
  const results: StepResult[] = [];
  const failures: StepFailure[] = [];

  const colMap = new Map(profile.columns.map((c) => [c.name, c]));

  for (const step of plan.steps) {
    const stepId = step.id;

    // 1. Check all referenced columns exist in profile
    const referencedCols: string[] = [];
    if (step.column !== null) referencedCols.push(step.column);
    if (step.by !== null) referencedCols.push(step.by);
    if (step.dateColumn !== null) referencedCols.push(step.dateColumn);
    for (const f of step.filters) {
      referencedCols.push(f.column);
    }

    let hasUnknownCol = false;
    for (const c of referencedCols) {
      if (!colMap.has(c)) {
        hasUnknownCol = true;
        break;
      }
    }
    if (hasUnknownCol) {
      failures.push({ stepId, reason: "unknown_column" });
      continue;
    }

    // 2. Check for PII columns and type mismatches
    let hasTypeMismatch = false;
    for (const c of referencedCols) {
      const col = colMap.get(c)!;
      if (col.kind === "pii") {
        hasTypeMismatch = true;
        break;
      }
    }
    if (hasTypeMismatch) {
      failures.push({ stepId, reason: "type_mismatch" });
      continue;
    }

    // Step kind & agg type checks
    if (step.agg === "sum" || step.agg === "avg") {
      if (!step.column) {
        failures.push({ stepId, reason: "type_mismatch" });
        continue;
      }
      const col = colMap.get(step.column)!;
      if (col.kind !== "number") {
        failures.push({ stepId, reason: "type_mismatch" });
        continue;
      }
    }

    if (step.kind === "group") {
      if (!step.by) {
        failures.push({ stepId, reason: "type_mismatch" });
        continue;
      }
      const col = colMap.get(step.by)!;
      if (col.kind !== "category" && col.kind !== "text") {
        failures.push({ stepId, reason: "type_mismatch" });
        continue;
      }
    } else if (step.kind === "trend") {
      if (!step.dateColumn || !step.interval) {
        failures.push({ stepId, reason: "type_mismatch" });
        continue;
      }
      const col = colMap.get(step.dateColumn)!;
      if (col.kind !== "date") {
        failures.push({ stepId, reason: "type_mismatch" });
        continue;
      }
    }

    // Filter checks
    for (const f of step.filters) {
      const col = colMap.get(f.column)!;
      if (["gt", "gte", "lt", "lte"].includes(f.op)) {
        if (col.kind !== "number" && col.kind !== "date") {
          hasTypeMismatch = true;
          break;
        }
        if (col.kind === "number") {
          if (
            typeof f.value !== "number" &&
            parseNumber(String(f.value)) === null
          ) {
            hasTypeMismatch = true;
            break;
          }
        } else if (col.kind === "date") {
          if (parseDate(String(f.value)) === null) {
            hasTypeMismatch = true;
            break;
          }
        }
      }
    }
    if (hasTypeMismatch) {
      failures.push({ stepId, reason: "type_mismatch" });
      continue;
    }

    // 3. Filter rows
    const filteredRows: Row[] = [];
    rowLoop: for (const row of rows) {
      for (const filter of step.filters) {
        const col = colMap.get(filter.column)!;
        const rawVal = row[filter.column] ?? "";

        if (filter.op === "eq" || filter.op === "neq") {
          let matches: boolean;
          if (col.kind === "number") {
            const rowN = parseNumber(rawVal);
            const filterN =
              typeof filter.value === "number"
                ? filter.value
                : parseNumber(String(filter.value));
            if (rowN === null || filterN === null) {
              matches = false;
            } else {
              matches = rowN === filterN;
            }
          } else {
            matches =
              rawVal.trim().toLowerCase() ===
              String(filter.value).trim().toLowerCase();
          }
          if (filter.op === "eq" && !matches) continue rowLoop;
          if (filter.op === "neq" && matches) continue rowLoop;
        } else if (["gt", "gte", "lt", "lte"].includes(filter.op)) {
          if (col.kind === "number") {
            const rowN = parseNumber(rawVal);
            const filterN =
              typeof filter.value === "number"
                ? filter.value
                : parseNumber(String(filter.value));
            if (rowN === null || filterN === null) continue rowLoop;
            if (filter.op === "gt" && !(rowN > filterN)) continue rowLoop;
            if (filter.op === "gte" && !(rowN >= filterN)) continue rowLoop;
            if (filter.op === "lt" && !(rowN < filterN)) continue rowLoop;
            if (filter.op === "lte" && !(rowN <= filterN)) continue rowLoop;
          } else if (col.kind === "date") {
            const rowD = parseDate(rawVal);
            const filterD = parseDate(String(filter.value));
            if (rowD === null || filterD === null) continue rowLoop;
            if (filter.op === "gt" && !(rowD > filterD)) continue rowLoop;
            if (filter.op === "gte" && !(rowD >= filterD)) continue rowLoop;
            if (filter.op === "lt" && !(rowD < filterD)) continue rowLoop;
            if (filter.op === "lte" && !(rowD <= filterD)) continue rowLoop;
          }
        }
      }
      filteredRows.push(row);
    }

    const rowsUsed = filteredRows.length;
    if (rowsUsed === 0) {
      failures.push({ stepId, reason: "empty_result" });
      continue;
    }

    // 4. Aggregate according to kind
    let stepRows: ResultRow[] = [];
    let anomalies: Anomaly[] = [];

    if (step.kind === "total") {
      if (step.agg === "count") {
        stepRows = [{ label: "Total", value: rowsUsed }];
      } else {
        const colName = step.column!;
        const nums: number[] = [];
        for (const r of filteredRows) {
          const n = parseNumber(r[colName] ?? "");
          if (n !== null) nums.push(n);
        }
        if (nums.length === 0) {
          failures.push({ stepId, reason: "empty_result" });
          continue;
        }
        const sum = nums.reduce((a, b) => a + b, 0);
        const val = step.agg === "sum" ? sum : sum / nums.length;
        stepRows = [{ label: "Total", value: Math.round(val * 100) / 100 }];
      }
    } else if (step.kind === "group") {
      const byCol = step.by!;
      const groupMap = new Map<string, { sum: number; count: number }>();

      for (const r of filteredRows) {
        const rawKey = r[byCol];
        const key =
          typeof rawKey === "string" && rawKey.trim() !== ""
            ? rawKey.trim()
            : "(blank)";

        let bucket = groupMap.get(key);
        if (!bucket) {
          bucket = { sum: 0, count: 0 };
          groupMap.set(key, bucket);
        }

        if (step.agg === "count") {
          bucket.count += 1;
        } else {
          const colName = step.column!;
          const n = parseNumber(r[colName] ?? "");
          if (n !== null) {
            bucket.sum += n;
            bucket.count += 1;
          }
        }
      }

      const candidateRows: ResultRow[] = [];
      for (const [label, bucket] of groupMap.entries()) {
        if (step.agg === "count") {
          if (bucket.count > 0) {
            candidateRows.push({ label, value: bucket.count });
          }
        } else if (step.agg === "sum") {
          if (bucket.count > 0) {
            candidateRows.push({
              label,
              value: Math.round(bucket.sum * 100) / 100,
            });
          }
        } else if (step.agg === "avg") {
          if (bucket.count > 0) {
            candidateRows.push({
              label,
              value: Math.round((bucket.sum / bucket.count) * 100) / 100,
            });
          }
        }
      }

      if (candidateRows.length === 0) {
        failures.push({ stepId, reason: "empty_result" });
        continue;
      }

      const sortDir = step.sort ?? "desc";
      candidateRows.sort((a, b) => {
        if (a.value !== b.value) {
          return sortDir === "asc" ? a.value - b.value : b.value - a.value;
        }
        return a.label.localeCompare(b.label);
      });

      const limit = step.limit ?? 10;
      stepRows = candidateRows.slice(0, limit);
    } else if (step.kind === "trend") {
      const dateCol = step.dateColumn!;
      const interval = step.interval!;
      const trendMap = new Map<string, { sum: number; count: number }>();

      for (const r of filteredRows) {
        const d = parseDate(r[dateCol] ?? "");
        if (!d) continue;
        const label = bucketLabel(d, interval);

        let bucket = trendMap.get(label);
        if (!bucket) {
          bucket = { sum: 0, count: 0 };
          trendMap.set(label, bucket);
        }

        if (step.agg === "count") {
          bucket.count += 1;
        } else {
          const colName = step.column!;
          const n = parseNumber(r[colName] ?? "");
          if (n !== null) {
            bucket.sum += n;
            bucket.count += 1;
          }
        }
      }

      if (trendMap.size === 0) {
        failures.push({ stepId, reason: "empty_result" });
        continue;
      }

      const sortedLabels = Array.from(trendMap.keys()).sort();
      const firstLabel = sortedLabels[0];
      const lastLabel = sortedLabels[sortedLabels.length - 1];

      let candidateRows: ResultRow[] = [];

      if (step.agg === "sum" || step.agg === "count") {
        // Fill missing buckets between first and last with 0
        if (interval === "day") {
          const [fy, fm, fd] = firstLabel.split("-").map(Number);
          const [ly, lm, ld] = lastLabel.split("-").map(Number);
          const curr = new Date(Date.UTC(fy, fm - 1, fd));
          const lastTime = Date.UTC(ly, lm - 1, ld);

          while (curr.getTime() <= lastTime) {
            const yStr = curr.getUTCFullYear();
            const mStr = String(curr.getUTCMonth() + 1).padStart(2, "0");
            const dStr = String(curr.getUTCDate()).padStart(2, "0");
            const lbl = `${yStr}-${mStr}-${dStr}`;
            const bucket = trendMap.get(lbl);

            let val = 0;
            if (bucket) {
              val = step.agg === "count" ? bucket.count : Math.round(bucket.sum * 100) / 100;
            }
            candidateRows.push({ label: lbl, value: val });
            curr.setUTCDate(curr.getUTCDate() + 1);
          }
        } else if (interval === "week") {
          const [fy, fm, fd] = firstLabel.split("-").map(Number);
          const [ly, lm, ld] = lastLabel.split("-").map(Number);
          const curr = new Date(Date.UTC(fy, fm - 1, fd));
          const lastTime = Date.UTC(ly, lm - 1, ld);

          while (curr.getTime() <= lastTime) {
            const yStr = curr.getUTCFullYear();
            const mStr = String(curr.getUTCMonth() + 1).padStart(2, "0");
            const dStr = String(curr.getUTCDate()).padStart(2, "0");
            const lbl = `${yStr}-${mStr}-${dStr}`;
            const bucket = trendMap.get(lbl);

            let val = 0;
            if (bucket) {
              val = step.agg === "count" ? bucket.count : Math.round(bucket.sum * 100) / 100;
            }
            candidateRows.push({ label: lbl, value: val });
            curr.setUTCDate(curr.getUTCDate() + 7);
          }
        } else if (interval === "month") {
          let [cy, cm] = firstLabel.split("-").map(Number);
          const [ey, em] = lastLabel.split("-").map(Number);

          while (cy < ey || (cy === ey && cm <= em)) {
            const lbl = `${cy}-${String(cm).padStart(2, "0")}`;
            const bucket = trendMap.get(lbl);

            let val = 0;
            if (bucket) {
              val = step.agg === "count" ? bucket.count : Math.round(bucket.sum * 100) / 100;
            }
            candidateRows.push({ label: lbl, value: val });

            cm++;
            if (cm > 12) {
              cm = 1;
              cy++;
            }
          }
        }
      } else {
        // avg: do not fill empty buckets with 0
        for (const lbl of sortedLabels) {
          const b = trendMap.get(lbl)!;
          if (b.count > 0) {
            candidateRows.push({
              label: lbl,
              value: Math.round((b.sum / b.count) * 100) / 100,
            });
          }
        }
      }

      // Cap 400 buckets: if more, keep the last 400
      if (candidateRows.length > 400) {
        candidateRows = candidateRows.slice(-400);
      }

      if (candidateRows.length === 0) {
        failures.push({ stepId, reason: "empty_result" });
        continue;
      }

      stepRows = candidateRows;
      anomalies = detectAnomalies(stepRows);
    }

    if (stepRows.length === 0) {
      failures.push({ stepId, reason: "empty_result" });
      continue;
    }

    results.push({
      stepId,
      title: step.title,
      kind: step.kind,
      agg: step.agg,
      column: step.column,
      rows: stepRows,
      rowsUsed,
      anomalies,
    });
  }

  return { results, failures };
}

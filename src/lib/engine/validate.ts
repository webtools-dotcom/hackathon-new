import type { DatasetProfile, Plan, PlanIssue } from "./schemas";
import { parseDate, parseNumber } from "./profile";

export function validatePlan(
  plan: Plan,
  profile: DatasetProfile
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const colMap = new Map(profile.columns.map((c) => [c.name, c]));
  const seenIds = new Set<string>();

  for (const step of plan.steps) {
    const stepId = step.id;

    // Check duplicate step ID
    if (seenIds.has(stepId)) {
      issues.push({
        stepId,
        code: "duplicate_step_id",
        message: `Duplicate step id: ${stepId}`,
      });
    } else {
      seenIds.add(stepId);
    }

    // Helper to check column existence & PII
    const checkColumnRef = (colName: string | null): boolean => {
      if (colName === null) return true;
      const col = colMap.get(colName);
      if (!col) {
        issues.push({
          stepId,
          code: "unknown_column",
          message: `Referenced column "${colName}" not found in dataset`,
        });
        return false;
      }
      if (col.kind === "pii") {
        issues.push({
          stepId,
          code: "pii_column",
          message: `Referenced column "${colName}" is a PII column`,
        });
        return false;
      }
      return true;
    };

    // Check referenced columns for existence and PII
    if (step.agg === "sum" || step.agg === "avg") {
      if (!step.column) {
        issues.push({
          stepId,
          code: "missing_field",
          message: `Aggregation "${step.agg}" requires a column`,
        });
      } else {
        const ok = checkColumnRef(step.column);
        if (ok) {
          const col = colMap.get(step.column);
          if (col && col.kind !== "number") {
            issues.push({
              stepId,
              code: "wrong_column_kind",
              message: `Aggregation "${step.agg}" requires number column, found "${col.kind}"`,
            });
          }
        }
      }
    } else if (step.agg === "count") {
      // agg count ignores column, but if provided check it
      if (step.column !== null) {
        checkColumnRef(step.column);
      }
    }

    if (step.kind === "group") {
      if (!step.by) {
        issues.push({
          stepId,
          code: "missing_field",
          message: "Group step requires 'by' column",
        });
      } else {
        const ok = checkColumnRef(step.by);
        if (ok) {
          const col = colMap.get(step.by);
          if (col && col.kind !== "category" && col.kind !== "text") {
            issues.push({
              stepId,
              code: "wrong_column_kind",
              message: `Group 'by' column must be category or text, found "${col.kind}"`,
            });
          }
        }
      }
    } else if (step.kind === "trend") {
      if (!step.dateColumn) {
        issues.push({
          stepId,
          code: "missing_field",
          message: "Trend step requires 'dateColumn'",
        });
      } else {
        const ok = checkColumnRef(step.dateColumn);
        if (ok) {
          const col = colMap.get(step.dateColumn);
          if (col && col.kind !== "date") {
            issues.push({
              stepId,
              code: "wrong_column_kind",
              message: `Trend 'dateColumn' must be date, found "${col.kind}"`,
            });
          }
        }
      }
      if (!step.interval) {
        issues.push({
          stepId,
          code: "missing_field",
          message: "Trend step requires 'interval'",
        });
      }
    }

    // Check filters
    for (const filter of step.filters) {
      const ok = checkColumnRef(filter.column);
      if (ok) {
        const col = colMap.get(filter.column);
        if (["gt", "gte", "lt", "lte"].includes(filter.op)) {
          if (!col || (col.kind !== "number" && col.kind !== "date")) {
            issues.push({
              stepId,
              code: "wrong_column_kind",
              message: `Filter operation "${filter.op}" requires number or date column`,
            });
          } else if (col.kind === "number") {
            if (
              typeof filter.value !== "number" &&
              parseNumber(String(filter.value)) === null
            ) {
              issues.push({
                stepId,
                code: "wrong_column_kind",
                message: `Filter value "${filter.value}" is not a valid number for column "${filter.column}"`,
              });
            }
          } else if (col.kind === "date") {
            if (parseDate(String(filter.value)) === null) {
              issues.push({
                stepId,
                code: "wrong_column_kind",
                message: `Filter value "${filter.value}" is not a valid date for column "${filter.column}"`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

export function sanitizePlan(
  plan: Plan,
  profile: DatasetProfile
): Plan | null {
  const issues = validatePlan(plan, profile);
  const badStepIds = new Set(issues.map((i) => i.stepId));

  const validSteps = plan.steps.filter((s) => !badStepIds.has(s.id));
  if (validSteps.length === 0) {
    return null;
  }

  return {
    ...plan,
    steps: validSteps,
  };
}

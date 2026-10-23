import type { Action, StepResult } from "./schemas";

export function verifyActions(
  actions: Action[],
  results: StepResult[]
): { valid: Action[]; rejected: number } {
  const valid: Action[] = [];
  const resultMap = new Map(results.map((r) => [r.stepId, r]));

  for (const action of actions) {
    if (!action.evidence || action.evidence.length === 0) {
      continue;
    }

    let allEvidenceValid = true;

    for (const ev of action.evidence) {
      const step = resultMap.get(ev.stepId);
      if (!step) {
        allEvidenceValid = false;
        break;
      }

      let matched = false;

      // Check step rows
      const rowMatch = step.rows.find((r) => r.label === ev.label);
      if (rowMatch) {
        const tol = Math.max(0.01, 0.005 * Math.abs(rowMatch.value));
        if (Math.abs(ev.value - rowMatch.value) <= tol) {
          matched = true;
        }
      }

      // Check step anomalies if not matched
      if (!matched && step.anomalies) {
        const anomalyMatch = step.anomalies.find((a) => a.label === ev.label);
        if (anomalyMatch) {
          const tol = Math.max(0.01, 0.005 * Math.abs(anomalyMatch.value));
          if (Math.abs(ev.value - anomalyMatch.value) <= tol) {
            matched = true;
          }
        }
      }

      if (!matched) {
        allEvidenceValid = false;
        break;
      }
    }

    if (allEvidenceValid) {
      valid.push(action);
    }
  }

  return {
    valid,
    rejected: actions.length - valid.length,
  };
}

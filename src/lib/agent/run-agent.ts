import Papa from "papaparse";
import type {
  Row,
  DatasetProfile,
  Plan,
  StepResult,
  Action,
} from "@/lib/engine/schemas";
import type {
  PlanRequest,
  PlanResponse,
  NarrateRequest,
  NarrateResponse,
  ResponseMeta,
} from "@/lib/server/contracts";
import { profileRows } from "@/lib/engine/profile";
import { buildSamples } from "@/lib/engine/mask";
import { executePlan } from "@/lib/engine/execute";
import { buildFallbackPlan, buildFallbackActions } from "@/lib/engine/fallback";
import { SAMPLE_PLAN } from "@/lib/sample-data";

export type TraceStepId =
  | "parse"
  | "profile"
  | "mask"
  | "plan"
  | "execute"
  | "verify"
  | "replan"
  | "narrate";

export type TraceStatus = "running" | "done" | "error" | "skipped";

export interface TraceEvent {
  id: TraceStepId;
  label: string;
  status: TraceStatus;
  durationMs: number | null;
  detail: string;
}

export interface ModelPayloads {
  plan: PlanRequest | null;
  replan: PlanRequest | null;
  narrate: NarrateRequest | null;
}

export interface AgentMetrics {
  rawBytes: number;
  rowCount: number;
  sentBytes: number;
  rawRowsSent: 0;
  maskedSampleRows: number;
  piiColumns: string[];
  promptTokens: number;
  outputTokens: number;
  sources: {
    plan: ResponseMeta["source"] | "demo";
    narrate: ResponseMeta["source"] | "demo";
  };
  totalMs: number;
}

export interface AgentOutput {
  profile: DatasetProfile;
  plan: Plan;
  results: StepResult[];
  actions: Action[];
  rejectedActions: number;
  payloads: ModelPayloads;
  metrics: AgentMetrics;
  trace: TraceEvent[];
}

export interface AgentDeps {
  postJson: <T>(
    url: "/api/plan" | "/api/narrate",
    body: unknown
  ) => Promise<
    | { ok: true; data: T; bytes: number }
    | { ok: false; status: number; bytes: number }
  >;
  now: () => number;
}

export const defaultDeps: AgentDeps = {
  now: () => performance.now(),
  postJson: async <T>(url: "/api/plan" | "/api/narrate", body: unknown) => {
    const jsonStr = JSON.stringify(body);
    const bytes = new TextEncoder().encode(jsonStr).length;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonStr,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        return { ok: false as const, status: res.status, bytes };
      }
      const data = (await res.json()) as T;
      return { ok: true as const, data, bytes };
    } catch {
      return { ok: false as const, status: 0, bytes };
    }
  },
};

export const MAX_CSV_BYTES = 5_000_000;

export function errorMessage(code: string): string {
  switch (code) {
    case "file_too_large":
      return "That file is over 5 MB. Export a smaller date range.";
    case "empty_file":
      return "We couldn't find any rows. Check that the first line has column names.";
    case "unsupported_data":
      return "We need at least one number, category or date column to analyse.";
    case "too_many_columns":
      return "That file has more than 40 columns. Remove the ones you don't need.";
    default:
      return "Something went wrong. Try again, or use the sample data.";
  }
}

export async function runAgent(
  input: { csvText: string; question?: string; demo: boolean },
  deps: AgentDeps,
  onTrace: (trace: TraceEvent[]) => void
): Promise<AgentOutput> {
  const startTime = deps.now();
  const trace: TraceEvent[] = [];
  const payloads: ModelPayloads = {
    plan: null,
    replan: null,
    narrate: null,
  };
  let sentBytes = 0;
  let promptTokens = 0;
  let outputTokens = 0;
  let planSource: ResponseMeta["source"] | "demo" = "fallback";
  let narrateSource: ResponseMeta["source"] | "demo" = "fallback";

  const updateTrace = (event: TraceEvent) => {
    const idx = trace.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      trace[idx] = event;
    } else {
      trace.push(event);
    }
    onTrace([...trace]);
  };

  let currentStepId: TraceStepId = "parse";
  let currentStepLabel = "Reading the file";
  let stepStart = deps.now();

  try {
    // 1. parse
    currentStepId = "parse";
    currentStepLabel = "Reading the file";
    stepStart = deps.now();
    updateTrace({
      id: "parse",
      label: "Reading the file",
      status: "running",
      durationMs: null,
      detail: "",
    });

    const rawBytes = new TextEncoder().encode(input.csvText).length;
    if (rawBytes > MAX_CSV_BYTES) {
      throw new Error("file_too_large");
    }

    const parsed = Papa.parse<Row>(input.csvText, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parsed.data;
    const fields = parsed.meta.fields ?? [];
    if (rows.length === 0 || fields.length === 0) {
      throw new Error("empty_file");
    }

    updateTrace({
      id: "parse",
      label: "Reading the file",
      status: "done",
      durationMs: Math.max(0, deps.now() - stepStart),
      detail: `${rows.length} rows, ${fields.length} columns`,
    });

    // 2. profile
    currentStepId = "profile";
    currentStepLabel = "Profiling columns";
    stepStart = deps.now();
    updateTrace({
      id: "profile",
      label: "Profiling columns",
      status: "running",
      durationMs: null,
      detail: "",
    });

    const profile = profileRows(rows, fields);
    const numCount = profile.columns.filter((c) => c.kind === "number").length;
    const dateCount = profile.columns.filter((c) => c.kind === "date").length;
    const catCount = profile.columns.filter((c) => c.kind === "category").length;

    updateTrace({
      id: "profile",
      label: "Profiling columns",
      status: "done",
      durationMs: Math.max(0, deps.now() - stepStart),
      detail: `${fields.length} columns: ${numCount} numeric, ${dateCount} date, ${catCount} category`,
    });

    // 3. mask
    currentStepId = "mask";
    currentStepLabel = "Masking personal data";
    stepStart = deps.now();
    updateTrace({
      id: "mask",
      label: "Masking personal data",
      status: "running",
      durationMs: null,
      detail: "",
    });

    const samples = buildSamples(rows, profile);
    const piiCols = profile.columns
      .filter((c) => c.kind === "pii")
      .map((c) => c.name);
    const maskDetail =
      piiCols.length > 0
        ? `${piiCols.length} personal columns masked: ${piiCols.join(", ")}`
        : "No personal columns found";

    updateTrace({
      id: "mask",
      label: "Masking personal data",
      status: "done",
      durationMs: Math.max(0, deps.now() - stepStart),
      detail: maskDetail,
    });

    // 4. plan
    currentStepId = "plan";
    currentStepLabel = "Planning with Gemini";
    stepStart = deps.now();
    updateTrace({
      id: "plan",
      label: "Planning with Gemini",
      status: "running",
      durationMs: null,
      detail: "",
    });

    const planReq: PlanRequest = {
      question: input.question || undefined,
      profile,
      samples,
    };
    payloads.plan = planReq;

    let plan: Plan;
    let planDetail = "";
    const planRes = await deps.postJson<PlanResponse>("/api/plan", planReq);
    sentBytes += planRes.bytes;

    if (planRes.ok) {
      plan = planRes.data.plan;
      planSource = planRes.data.meta.source;
      promptTokens += planRes.data.meta.promptTokens;
      outputTokens += planRes.data.meta.outputTokens;
      planDetail = `${plan.steps.length} steps · ${planSource} · ${planRes.data.meta.promptTokens} tokens in`;
    } else {
      if (input.demo) {
        plan = SAMPLE_PLAN;
        planSource = "demo";
        planDetail = "Offline: cached demo plan";
      } else {
        const fallback = buildFallbackPlan(profile);
        if (!fallback) {
          throw new Error("unsupported_data");
        }
        plan = fallback;
        planSource = "fallback";
        planDetail = "Offline: rules-based plan";
      }
    }

    updateTrace({
      id: "plan",
      label: "Planning with Gemini",
      status: "done",
      durationMs: Math.max(0, deps.now() - stepStart),
      detail: planDetail,
    });

    // 5. execute
    currentStepId = "execute";
    currentStepLabel = "Computing in your browser";
    stepStart = deps.now();
    updateTrace({
      id: "execute",
      label: "Computing in your browser",
      status: "running",
      durationMs: null,
      detail: "",
    });

    let execOutput = executePlan(plan, rows, profile);

    updateTrace({
      id: "execute",
      label: "Computing in your browser",
      status: "done",
      durationMs: Math.max(0, deps.now() - stepStart),
      detail: `${execOutput.results.length} of ${plan.steps.length} steps computed`,
    });

    // 6. verify & replan
    currentStepId = "verify";
    currentStepLabel = "Checking results";
    stepStart = deps.now();
    updateTrace({
      id: "verify",
      label: "Checking results",
      status: "running",
      durationMs: null,
      detail: "",
    });

    if (execOutput.failures.length === 0) {
      updateTrace({
        id: "verify",
        label: "Checking results",
        status: "done",
        durationMs: Math.max(0, deps.now() - stepStart),
        detail: "All steps returned data",
      });

      updateTrace({
        id: "replan",
        label: "Re-planning once",
        status: "skipped",
        durationMs: null,
        detail: "No re-plan needed",
      });
    } else {
      const failureReasons = execOutput.failures
        .map((f) => f.reason)
        .join(", ");
      updateTrace({
        id: "verify",
        label: "Checking results",
        status: "done",
        durationMs: Math.max(0, deps.now() - stepStart),
        detail: `${execOutput.failures.length} steps failed: ${failureReasons}`,
      });

      // Run replan
      currentStepId = "replan";
      currentStepLabel = "Re-planning once";
      stepStart = deps.now();
      updateTrace({
        id: "replan",
        label: "Re-planning once",
        status: "running",
        durationMs: null,
        detail: "",
      });

      const replanReq: PlanRequest = {
        question: input.question || undefined,
        profile,
        samples,
        retry: {
          previousPlan: plan,
          failures: execOutput.failures,
        },
      };
      payloads.replan = replanReq;

      const replanRes = await deps.postJson<PlanResponse>(
        "/api/plan",
        replanReq
      );
      sentBytes += replanRes.bytes;

      let replanDetail = "Re-plan unavailable";
      if (replanRes.ok) {
        promptTokens += replanRes.data.meta.promptTokens;
        outputTokens += replanRes.data.meta.outputTokens;
        const newPlan = replanRes.data.plan;
        const newExecOutput = executePlan(newPlan, rows, profile);
        if (newExecOutput.results.length > execOutput.results.length) {
          plan = newPlan;
          execOutput = newExecOutput;
        }
        replanDetail = `${newPlan.steps.length} steps · ${replanRes.data.meta.source}`;
      }

      updateTrace({
        id: "replan",
        label: "Re-planning once",
        status: "done",
        durationMs: Math.max(0, deps.now() - stepStart),
        detail: replanDetail,
      });
    }

    // 7. narrate
    currentStepId = "narrate";
    currentStepLabel = "Writing actions";
    stepStart = deps.now();
    updateTrace({
      id: "narrate",
      label: "Writing actions",
      status: "running",
      durationMs: null,
      detail: "",
    });

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

    const narrateReq: NarrateRequest = {
      question: input.question || undefined,
      results: sanitizedResults,
    };
    payloads.narrate = narrateReq;

    let actions: Action[] = [];
    let rejectedActions = 0;
    let narrateDetail = "";

    const narrateRes = await deps.postJson<NarrateResponse>(
      "/api/narrate",
      narrateReq
    );
    sentBytes += narrateRes.bytes;

    if (narrateRes.ok) {
      actions = narrateRes.data.actions;
      rejectedActions = narrateRes.data.rejected;
      narrateSource = narrateRes.data.meta.source;
      promptTokens += narrateRes.data.meta.promptTokens;
      outputTokens += narrateRes.data.meta.outputTokens;
      narrateDetail = `${actions.length} actions · ${rejectedActions} rejected by number check`;
    } else {
      actions = buildFallbackActions(execOutput.results);
      rejectedActions = 0;
      narrateSource = "fallback";
      narrateDetail = "Offline: rules-based actions";
    }

    updateTrace({
      id: "narrate",
      label: "Writing actions",
      status: "done",
      durationMs: Math.max(0, deps.now() - stepStart),
      detail: narrateDetail,
    });

    const totalMs = Math.max(0, deps.now() - startTime);

    const metrics: AgentMetrics = {
      rawBytes,
      rowCount: rows.length,
      sentBytes,
      rawRowsSent: 0,
      maskedSampleRows: samples.length,
      piiColumns: piiCols,
      promptTokens,
      outputTokens,
      sources: {
        plan: planSource,
        narrate: narrateSource,
      },
      totalMs,
    };

    return {
      profile,
      plan,
      results: execOutput.results,
      actions,
      rejectedActions,
      payloads,
      metrics,
      trace,
    };
  } catch (err: unknown) {
    const errCode = err instanceof Error ? err.message : String(err);
    updateTrace({
      id: currentStepId,
      label: currentStepLabel,
      status: "error",
      durationMs: Math.max(0, deps.now() - stepStart),
      detail: errorMessage(errCode),
    });
    throw err;
  }
}

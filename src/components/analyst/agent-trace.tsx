"use client";

import {
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Circle,
} from "lucide-react";
import type { TraceEvent, TraceStepId } from "@/lib/agent/run-agent";

interface StepConfig {
  id: TraceStepId;
  defaultLabel: string;
}

const ALL_STEPS: StepConfig[] = [
  { id: "parse", defaultLabel: "Reading the file" },
  { id: "profile", defaultLabel: "Profiling columns" },
  { id: "mask", defaultLabel: "Masking personal data" },
  { id: "plan", defaultLabel: "Planning with Gemini" },
  { id: "execute", defaultLabel: "Computing in your browser" },
  { id: "verify", defaultLabel: "Checking results" },
  { id: "replan", defaultLabel: "Re-planning once" },
  { id: "narrate", defaultLabel: "Writing actions" },
];

function formatDuration(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${Math.round(ms)} ms`;
}

export function AgentTrace({ trace }: { trace: TraceEvent[] }) {
  const traceMap = new Map(trace.map((e) => [e.id, e]));

  return (
    <ol className="space-y-3 text-sm">
      {ALL_STEPS.map((step) => {
        const event = traceMap.get(step.id);
        const status = event?.status ?? "not_started";
        const label = event?.label ?? step.defaultLabel;
        const detail = event?.detail ?? "";
        const durationText = formatDuration(event?.durationMs ?? null);

        let icon = (
          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
        );
        let statusText = "Not started";

        if (status === "running") {
          icon = (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          );
          statusText = "Running";
        } else if (status === "done") {
          icon = (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          );
          statusText = "Completed";
        } else if (status === "error") {
          icon = (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          );
          statusText = "Failed";
        } else if (status === "skipped") {
          icon = (
            <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          );
          statusText = "Skipped";
        }

        return (
          <li
            key={step.id}
            className="flex items-start justify-between gap-3 transition-opacity duration-300"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="mt-0.5" title={statusText}>
                {icon}
              </span>
              <div className="min-w-0">
                <p
                  className={`font-medium leading-tight ${
                    status === "not_started"
                      ? "text-muted-foreground/60"
                      : "text-foreground"
                  }`}
                >
                  {label}
                </p>
                {detail ? (
                  <p
                    className={`mt-0.5 text-xs truncate ${
                      status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                    title={detail}
                  >
                    {detail}
                  </p>
                ) : null}
              </div>
            </div>
            {durationText ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground pt-0.5">
                {durationText}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

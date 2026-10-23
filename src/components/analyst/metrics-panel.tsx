"use client";

import { Badge } from "@/components/ui/badge";
import type { AgentMetrics, TraceEvent } from "@/lib/agent/run-agent";

interface MetricsPanelProps {
  metrics: AgentMetrics;
  trace: TraceEvent[];
}

function sourceLabel(source: string): string {
  switch (source) {
    case "gemini":
      return "Gemini";
    case "cache":
      return "Cached";
    case "demo":
      return "Demo";
    case "fallback":
    default:
      return "Offline";
  }
}

export function MetricsPanel({ metrics, trace }: MetricsPanelProps) {
  const sentRatio = Math.min(
    100,
    Math.max(0, (metrics.sentBytes / (metrics.rawBytes || 1)) * 100)
  );

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm space-y-4">
      <h2 className="text-sm font-semibold tracking-tight">Performance & Privacy</h2>

      <dl className="space-y-3 text-xs">
        <div className="flex justify-between items-center">
          <dt className="text-muted-foreground">Total time</dt>
          <dd className="font-medium tabular-nums">
            {(metrics.totalMs / 1000).toFixed(2)} s
          </dd>
        </div>

        <div className="space-y-1 pt-1 border-t">
          <dt className="text-muted-foreground pb-1">Step timings</dt>
          {trace
            .filter((e) => e.status === "done" && e.durationMs !== null)
            .map((e) => (
              <div
                key={e.id}
                className="flex justify-between text-muted-foreground"
              >
                <span className="truncate pr-2">{e.label}</span>
                <span className="shrink-0 tabular-nums font-mono text-foreground">
                  {e.durationMs !== null
                    ? e.durationMs >= 1000
                      ? `${(e.durationMs / 1000).toFixed(2)} s`
                      : `${Math.round(e.durationMs)} ms`
                    : "-"}
                </span>
              </div>
            ))}
        </div>

        <div className="space-y-1.5 pt-1 border-t">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Sent vs file size</dt>
            <dd className="font-medium tabular-nums">
              {sentRatio.toFixed(1)}%
            </dd>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${sentRatio}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-1 border-t">
          <dt className="text-muted-foreground">Tokens</dt>
          <dd className="font-medium tabular-nums">
            {metrics.promptTokens.toLocaleString("en-IN")} in /{" "}
            {metrics.outputTokens.toLocaleString("en-IN")} out
          </dd>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
          <Badge variant="secondary" className="text-[10px]">
            Plan: {sourceLabel(metrics.sources.plan)}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            Actions: {sourceLabel(metrics.sources.narrate)}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] border-primary/50 text-primary"
          >
            Raw rows sent: 0
          </Badge>
        </div>
      </dl>
    </div>
  );
}

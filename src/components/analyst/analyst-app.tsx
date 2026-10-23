"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Hero } from "./hero";
import { ErrorState } from "./error-state";
import { AgentTrace } from "./agent-trace";
import { KpiStrip } from "./kpi-strip";
import { ResultChart } from "./result-chart";
import { ActionsPanel } from "./actions-panel";
import { PayloadDrawer } from "./payload-drawer";
import { MetricsPanel } from "./metrics-panel";
import { InsightBanner } from "./insight-banner";
import {
  runAgent,
  defaultDeps,
  errorMessage,
  type AgentOutput,
  type TraceEvent,
} from "@/lib/agent/run-agent";
import { SAMPLE_CSV, SAMPLE_FILE_NAME } from "@/lib/sample-data";

type AppStatus = "idle" | "running" | "done" | "error";



export function AnalystApp() {
  const [status, setStatus] = React.useState<AppStatus>("idle");
  const [trace, setTrace] = React.useState<TraceEvent[]>([]);
  const [output, setOutput] = React.useState<AgentOutput | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setTrace([]);
    setOutput(null);
    setError(null);
    setFileName(null);
  };

  const handleRun = async (input: {
    csvText: string;
    fileName: string;
    question?: string;
    demo: boolean;
  }) => {
    setStatus("running");
    setError(null);
    setOutput(null);
    setTrace([]);
    setFileName(input.fileName);

    try {
      const res = await runAgent(
        {
          csvText: input.csvText,
          question: input.question,
          demo: input.demo,
        },
        defaultDeps,
        (newTrace) => setTrace(newTrace)
      );
      setOutput(res);
      setStatus("done");
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : String(err);
      setError(errorMessage(code));
      setStatus("error");
    }
  };

  const handleError = (code: string) => {
    setError(errorMessage(code));
    setStatus("error");
  };

  const statusText =
    status === "running"
      ? "Analysis in progress..."
      : status === "done"
      ? "Analysis complete"
      : status === "error"
      ? `Error: ${error}`
      : "Idle";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </div>

      {status === "idle" ? (
        <Hero onRun={handleRun} onError={handleError} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Dataset Analysis
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground truncate max-w-md">
                {fileName ?? "Analysis"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {output ? (
                <PayloadDrawer
                  payloads={output.payloads}
                  metrics={output.metrics}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={reset}
                className="flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Start over
              </Button>
            </div>
          </div>

          {status === "error" ? (
            <ErrorState
              message={error}
              onRetrySample={() =>
                handleRun({ csvText: SAMPLE_CSV, fileName: SAMPLE_FILE_NAME, demo: true })
              }
              onReset={reset}
            />
          ) : (
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              {/* Sidebar: Trace & Metrics */}
              <div className="w-full shrink-0 space-y-4 lg:w-80 lg:sticky lg:top-20">
                <section
                  aria-labelledby="trace-title"
                  className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <h2 id="trace-title" className="mb-3 text-sm font-semibold">
                    Agent trace
                  </h2>
                  <AgentTrace trace={trace} />
                </section>

                {output ? (
                  <MetricsPanel
                    metrics={output.metrics}
                    trace={output.trace}
                  />
                ) : null}
              </div>

              {/* Main Content Area */}
              <div className="flex-1 space-y-6 min-w-0">
                {status === "running" ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Skeleton className="h-24 w-full rounded-lg" />
                      <Skeleton className="h-24 w-full rounded-lg" />
                      <Skeleton className="h-24 w-full rounded-lg" />
                    </div>
                    <Skeleton className="h-72 w-full rounded-lg" />
                    <Skeleton className="h-72 w-full rounded-lg" />
                  </div>
                ) : output ? (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <InsightBanner results={output.results} />
                    <KpiStrip
                      results={output.results}
                      rowCount={output.profile.rowCount}
                    />

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {output.results
                        .filter(
                          (r) => r.kind === "group" || r.kind === "trend"
                        )
                        .map((r) => {
                          const step = output.plan.steps.find(
                            (s) => s.id === r.stepId
                          );
                          return (
                            <ResultChart
                              key={r.stepId}
                              result={r}
                              interval={step?.interval ?? null}
                            />
                          );
                        })}
                    </div>

                    <ActionsPanel
                      actions={output.actions}
                      results={output.results}
                      rejectedActions={output.rejectedActions}
                      source={output.metrics.sources.narrate}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

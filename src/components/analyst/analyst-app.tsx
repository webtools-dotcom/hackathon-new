"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  ListChecks,
  RotateCcw,
  TriangleAlert,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadPanel } from "./upload-panel";
import { AgentTrace } from "./agent-trace";
import { KpiStrip } from "./kpi-strip";
import { ResultChart } from "./result-chart";
import { ActionsPanel } from "./actions-panel";
import { PayloadDrawer } from "./payload-drawer";
import { MetricsPanel } from "./metrics-panel";
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
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                For restaurants, kirana stores and clinics
              </p>
              <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
                Ask your sales ledger what changed.
              </h1>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                Tijori plans the analysis with Gemini, does the maths in your
                browser, and hands you three actions with the numbers behind
                them. Customer names and phone numbers never leave this page.
              </p>
            </div>

            <UploadPanel onRun={handleRun} onError={handleError} />
          </div>

          <div className="lg:col-span-5 space-y-6 lg:pl-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
              <ol className="mt-4 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium">1. Choose a sales CSV</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload your transaction export from POS or billing software.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium">2. Data stays locked in browser</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Personal names, phone numbers and emails are masked right here.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium">3. Gemini plans the queries</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The model receives only the column profile and masked samples.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium">4. Verified actions computed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your browser computes the results and Gemini provides 3 cited actions.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="rounded-xl border bg-primary/5 border-primary/20 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    0 raw rows sent to the model
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    By mathematical construction, only column names, summary types,
                    and 5 masked sample rows are sent to plan. Calculations run locally.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Dataset Analysis
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground truncate max-w-md">
                {fileName ?? "Analysis"}
              </h2>
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
            <Card className="p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
                <TriangleAlert className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold">Analysis Failed</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                {error}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() =>
                    handleRun({
                      csvText: SAMPLE_CSV,
                      fileName: SAMPLE_FILE_NAME,
                      demo: true,
                    })
                  }
                >
                  <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                  Try sample data
                </Button>
                <Button variant="outline" onClick={reset}>
                  Choose another file
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              {/* Sidebar: Trace & Metrics */}
              <div className="w-full shrink-0 space-y-4 lg:w-80 lg:sticky lg:top-20">
                <details
                  open
                  className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm lg:hidden"
                >
                  <summary className="cursor-pointer font-medium text-sm">
                    Agent trace & timings
                  </summary>
                  <div className="mt-4">
                    <AgentTrace trace={trace} />
                  </div>
                </details>

                <div className="hidden rounded-lg border bg-card p-4 text-card-foreground shadow-sm lg:block">
                  <h3 className="text-sm font-semibold mb-3">Agent trace</h3>
                  <AgentTrace trace={trace} />
                </div>

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
                  <div className="space-y-6">
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

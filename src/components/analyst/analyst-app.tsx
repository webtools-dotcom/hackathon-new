"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  ListChecks,
  RotateCcw,
  TriangleAlert,
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
import { PrivacyPreview } from "./privacy-preview";
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

const HOW_IT_WORKS = [
  { icon: FileSpreadsheet, title: "Drop a sales export", body: "Any CSV from your POS or billing app. It is parsed and profiled on this device." },
  { icon: ShieldCheck, title: "Personal data is masked", body: "Names, phones and emails are detected and replaced before anything is sent." },
  { icon: Sparkles, title: "Gemini plans, code computes", body: "Gemini picks allow-listed operations; a deterministic engine does the maths." },
  { icon: ListChecks, title: "Actions are fact-checked", body: "Every number Gemini cites is checked against the computed results." },
];

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
        <div className="relative isolate">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-[520px] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
          />
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-8 lg:col-span-7 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  For restaurants, kirana stores and clinics
                </p>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl sm:leading-[1.05]">
                  Ask your sales ledger <span className="text-primary">what changed.</span>
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Tijori plans the analysis with Gemini, does every calculation
                  in your browser, and hands you three actions with the numbers
                  behind them. Customer names and phone numbers never leave this
                  page.
                </p>
              </div>

              <UploadPanel onRun={handleRun} onError={handleError} />
            </div>

            <div className="lg:col-span-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <PrivacyPreview />
            </div>
          </div>

          <ol className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="bg-background p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <p className="mt-3 text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
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
            <Card className="p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
                <TriangleAlert className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold">Analysis Failed</h2>
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
                  <h2 className="text-sm font-semibold mb-3">Agent trace</h2>
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

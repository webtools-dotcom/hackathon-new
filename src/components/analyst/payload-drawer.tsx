"use client";

import * as React from "react";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { AgentMetrics, ModelPayloads } from "@/lib/agent/run-agent";

interface PayloadDrawerProps {
  payloads: ModelPayloads;
  metrics: AgentMetrics;
}

export function PayloadDrawer({ payloads, metrics }: PayloadDrawerProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const fileKb = (metrics.rawBytes / 1024).toFixed(1);
  const sentKb = (metrics.sentBytes / 1024).toFixed(1);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => dialogRef.current?.showModal()}
        className="flex items-center gap-1.5"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        What the model saw
      </Button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
        className="fixed inset-y-0 right-0 z-50 m-0 ml-auto hidden open:flex h-full max-h-screen w-full flex-col border-l border-border bg-background p-6 shadow-xl backdrop:bg-black/40 sm:max-w-lg"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-semibold">What the model saw</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Your file:</span>
              <span className="font-medium text-foreground">
                {fileKb} KB · {metrics.rowCount.toLocaleString("en-IN")} rows
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Sent to Gemini:</span>
              <span className="font-medium text-foreground">
                {sentKb} KB · {metrics.rawRowsSent} raw rows ·{" "}
                {metrics.maskedSampleRows} masked samples
              </span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {metrics.piiColumns.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">
                  Masked columns:
                </span>{" "}
                {metrics.piiColumns.join(", ")}
              </p>
            ) : (
              <p>No personal columns found</p>
            )}
          </div>

          <Tabs defaultValue="plan" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="plan">Plan request</TabsTrigger>
              {payloads.replan ? (
                <TabsTrigger value="replan">Re-plan request</TabsTrigger>
              ) : null}
              <TabsTrigger value="narrate">Narrate request</TabsTrigger>
            </TabsList>

            <TabsContent value="plan" className="mt-3">
              <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                {JSON.stringify(payloads.plan, null, 2)}
              </pre>
            </TabsContent>

            {payloads.replan ? (
              <TabsContent value="replan" className="mt-3">
                <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                  {JSON.stringify(payloads.replan, null, 2)}
                </pre>
              </TabsContent>
            ) : null}

            <TabsContent value="narrate" className="mt-3">
              <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                {JSON.stringify(payloads.narrate, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </dialog>
    </>
  );
}

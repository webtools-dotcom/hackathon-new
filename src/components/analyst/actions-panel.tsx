"use client";

import { CheckCircle2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Action, StepResult } from "@/lib/engine/schemas";
import { formatValue } from "@/lib/format";

interface ActionsPanelProps {
  actions: Action[];
  results: StepResult[];
  rejectedActions: number;
  source: string;
}

export function ActionsPanel({
  actions,
  results,
  rejectedActions,
  source,
}: ActionsPanelProps) {
  const stepColMap = new Map(results.map((r) => [r.stepId, r.column]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Recommended Actions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-primary" aria-hidden="true" />
            Checked against computed numbers
          </Badge>
          {rejectedActions > 0 ? (
            <Badge variant="destructive" className="text-xs">
              {rejectedActions} claims rejected
            </Badge>
          ) : null}
        </div>
      </div>

      {source === "fallback" ? (
        <p className="text-xs text-muted-foreground">
          Gemini was unavailable, so these are rules-based.
        </p>
      ) : null}

      <div className="space-y-3">
        {actions.map((action, idx) => (
          <Card key={idx} className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {idx + 1}
                </span>
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium">
                    {action.title}
                  </CardTitle>
                  <CardDescription className="text-sm text-foreground/80">
                    {action.detail}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 pl-13">
              <div className="flex flex-wrap gap-1.5">
                {action.evidence.map((ev, evIdx) => {
                  const col = stepColMap.get(ev.stepId) ?? null;
                  return (
                    <Badge
                      key={evIdx}
                      variant="secondary"
                      title={`Step: ${ev.stepId}`}
                      className="text-xs font-normal tabular-nums"
                    >
                      {ev.label}: {formatValue(ev.value, col)}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

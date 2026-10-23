"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { StepResult } from "@/lib/engine/schemas";
import { formatValue } from "@/lib/format";

interface KpiStripProps {
  results: StepResult[];
  rowCount: number;
}

function CountUpNumber({
  target,
  column,
}: {
  target: number;
  column: string | null;
}) {
  const [val, setVal] = React.useState(0);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const duration = 600;
    let animId: number;

    const tick = (now: number) => {
      const progress = reduced ? 1 : Math.min(1, (now - start) / duration);
      // easeOutQuad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(eased * target);
      setVal(current);

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [target]);

  return <span>{formatValue(val, column)}</span>;
}

export function KpiStrip({ results, rowCount }: KpiStripProps) {
  const totals = results.filter((r) => r.kind === "total");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {totals.map((res) => {
        const val = res.rows[0]?.value ?? 0;
        return (
          <Card key={res.stepId} className="shadow-sm">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {res.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-semibold tabular-nums tracking-tight">
                <CountUpNumber target={val} column={res.column} />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Rows analysed
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-semibold tabular-nums tracking-tight">
            {rowCount.toLocaleString("en-IN")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

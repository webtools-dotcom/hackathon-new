"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { TriangleAlert } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { StepResult } from "@/lib/engine/schemas";
import { formatValue } from "@/lib/format";
import { anomalyChangePct, describePeriod, formatPeriodLabel } from "@/lib/insights";

interface ResultChartProps {
  result: StepResult;
  interval?: "day" | "week" | "month" | null;
}

export function ResultChart({ result, interval }: ResultChartProps) {
  const chartConfig = {
    value: {
      label: result.title,
      color: "var(--primary)",
    },
  } satisfies ChartConfig;

  const isGroup = result.kind === "group";
  const isTrend = result.kind === "trend";
  const data = isGroup ? result.rows.slice(0, 10) : result.rows;

  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold">{result.title}</CardTitle>
        <CardDescription className="text-xs">
          {result.agg.toUpperCase()}{" "}
          {result.column ? `of ${result.column}` : ""} · {result.rowsUsed} rows
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div>
          <table className="sr-only">
            <caption>{result.title}</caption>
            <thead>
              <tr>
                <th scope="col">{isTrend ? "Period" : "Label"}</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{formatValue(r.value, result.column)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {isGroup ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full" aria-hidden="true">
              <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatValue(v, result.column)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={90}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="value"
                  fill="var(--color-value)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : isTrend ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full" aria-hidden="true">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => formatPeriodLabel(v)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tickFormatter={(v: number) => formatValue(v, result.column)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="value"
                  type="monotone"
                  fill="var(--color-value)"
                  fillOpacity={0.2}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                />
                {result.anomalies.map((anom) => (
                  <ReferenceDot
                    key={`dot-${anom.label}`}
                    x={anom.label}
                    y={anom.value}
                    r={6}
                    fill="var(--destructive)"
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                ))}
                {result.anomalies.map((anom) => (
                  <ReferenceLine
                    key={`line-${anom.label}`}
                    y={anom.expected}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="3 3"
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          ) : null}
        </div>

        {result.anomalies && result.anomalies.length > 0 ? (
          <div className="mt-3 space-y-1.5 border-t pt-3">
            {result.anomalies.map((anom) => {
              const prefix = describePeriod(anom.label, interval ?? null);
              const pct = anomalyChangePct(anom);
              const dir = anom.direction === "drop" ? "below" : "above";

              return (
                <div
                  key={anom.label}
                  className="flex items-center gap-2 text-xs text-destructive font-medium"
                >
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {prefix}: {formatValue(anom.value, result.column)}, about{" "}
                    {pct}% {dir} a typical{" "}
                    {formatValue(anom.expected, result.column)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

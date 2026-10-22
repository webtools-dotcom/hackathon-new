"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Replace with realistic dummy data for the problem statement
const trend = [
  { month: "Jan", value: 120 },
  { month: "Feb", value: 180 },
  { month: "Mar", value: 150 },
  { month: "Apr", value: 240 },
  { month: "May", value: 310 },
  { month: "Jun", value: 380 },
];

const breakdown = [
  { category: "A", value: 420 },
  { category: "B", value: 310 },
  { category: "C", value: 190 },
  { category: "D", value: 90 },
];

const config = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function TrendChart() {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart data={trend} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="value"
          type="natural"
          fill="var(--color-value)"
          fillOpacity={0.25}
          stroke="var(--color-value)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function BreakdownChart() {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={breakdown}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}

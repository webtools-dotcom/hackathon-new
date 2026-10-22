import { ArrowUpRight, Activity, Users, Target } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BreakdownChart, TrendChart } from "@/components/charts";

const stats = [
  { label: "Active users", value: "2,481", delta: "+12%", icon: Users },
  { label: "Impact score", value: "87", delta: "+5%", icon: Target },
  { label: "Weekly activity", value: "1,204", delta: "+18%", icon: Activity },
];

const rows = [
  { name: "Item one", status: "Resolved", value: 120 },
  { name: "Item two", status: "In progress", value: 85 },
  { name: "Item three", status: "Pending", value: 40 },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Hero: one line = the problem + your solution */}
        <section className="space-y-3">
          <Badge variant="secondary">Prompt War 2026</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One clear headline that states the solution
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            One sentence on who has the problem and how this fixes it.
          </p>
          <Button>
            Get started <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </section>

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{s.label}</CardDescription>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground">{s.delta} this month</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Charts */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Trend</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Breakdown</CardTitle>
              <CardDescription>By category</CardDescription>
            </CardHeader>
            <CardContent>
              <BreakdownChart />
            </CardContent>
          </Card>
        </section>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

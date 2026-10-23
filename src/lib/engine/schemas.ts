/** Zod schemas and types shared by the browser engine, the API routes and the model contract. */
import { z } from "zod";

export type Row = Record<string, string>; // papaparse output with header: true, all values strings

export const PiiTypeSchema = z.enum(["name", "phone", "email"]);
export type PiiType = z.infer<typeof PiiTypeSchema>;

export const ColumnKindSchema = z.enum(["number", "date", "category", "text", "pii"]);
export type ColumnKind = z.infer<typeof ColumnKindSchema>;

export const ColumnProfileSchema = z.object({
  name: z.string().min(1).max(64),
  kind: ColumnKindSchema,
  piiType: PiiTypeSchema.nullable(),          // non-null only when kind === "pii"
  distinct: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  min: z.union([z.number(), z.string().max(32)]).nullable(), // number cols: number; date cols: "YYYY-MM-DD"; else null
  max: z.union([z.number(), z.string().max(32)]).nullable(),
  topValues: z.array(z.string().max(64)).max(8), // category cols only (most frequent first); [] otherwise
});
export type ColumnProfile = z.infer<typeof ColumnProfileSchema>;

export const DatasetProfileSchema = z.object({
  rowCount: z.number().int().nonnegative().max(200_000),
  columns: z.array(ColumnProfileSchema).min(1).max(40),
});
export type DatasetProfile = z.infer<typeof DatasetProfileSchema>;

export const FilterSchema = z.object({
  column: z.string().min(1).max(64),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
  value: z.union([z.string().max(64), z.number()]),
});
export type Filter = z.infer<typeof FilterSchema>;

// Flat step shape on purpose: simpler JSON schema for Gemini structured output.
export const StepSchema = z.object({
  id: z.string().min(1).max(32),
  title: z.string().min(3).max(80),
  kind: z.enum(["total", "group", "trend"]),
  agg: z.enum(["sum", "avg", "count"]),
  column: z.string().max(64).nullable(),      // value column; may be null only when agg === "count"
  by: z.string().max(64).nullable(),          // required when kind === "group"
  dateColumn: z.string().max(64).nullable(),  // required when kind === "trend"
  interval: z.enum(["day", "week", "month"]).nullable(), // required when kind === "trend"
  sort: z.enum(["asc", "desc"]).nullable(),   // group only; null => "desc"
  limit: z.number().int().min(1).max(20).nullable(), // group only; null => 10
  filters: z.array(FilterSchema).max(3),
});
export type Step = z.infer<typeof StepSchema>;

export const PlanSchema = z.object({
  rationale: z.string().max(400),
  steps: z.array(StepSchema).min(1).max(6),
});
export type Plan = z.infer<typeof PlanSchema>;

export type PlanIssueCode =
  | "unknown_column" | "pii_column" | "wrong_column_kind"
  | "missing_field" | "duplicate_step_id";
export interface PlanIssue { stepId: string; code: PlanIssueCode; message: string }

export interface ResultRow { label: string; value: number }
export interface Anomaly {
  label: string;          // the bucket label, e.g. "2026-08-10"
  value: number;
  expected: number;       // median of the series
  direction: "spike" | "drop";
  score: number;          // robust z-score, rounded to 1 decimal
}
export interface StepResult {
  stepId: string;
  title: string;
  kind: Step["kind"];
  agg: Step["agg"];
  column: string | null;
  rows: ResultRow[];      // total => [{ label: "Total", value }]; group => sorted buckets; trend => ascending periods
  rowsUsed: number;       // input rows after filters
  anomalies: Anomaly[];   // only trend steps can have anomalies; [] otherwise
}
export type FailureReason = "unknown_column" | "type_mismatch" | "empty_result";
export interface StepFailure { stepId: string; reason: FailureReason }
export interface ExecutionOutput { results: StepResult[]; failures: StepFailure[] }

export const EvidenceSchema = z.object({
  stepId: z.string().min(1).max(32),
  label: z.string().min(1).max(64),
  value: z.number(),
});
export const ActionSchema = z.object({
  title: z.string().min(3).max(80),
  detail: z.string().min(10).max(280),
  evidence: z.array(EvidenceSchema).min(1).max(3),
});
export type Action = z.infer<typeof ActionSchema>;
export const NarrationSchema = z.object({ actions: z.array(ActionSchema).min(1).max(5) });
export type Narration = z.infer<typeof NarrationSchema>;

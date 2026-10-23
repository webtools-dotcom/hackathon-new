/** Strict request and response contracts for /api/plan and /api/narrate. */
import { z } from "zod";
import {
  DatasetProfileSchema,
  PlanSchema,
  StepSchema,
  type Plan,
  type Action,
} from "@/lib/engine/schemas";

const Cell = z.string().max(64);

export const PlanRequestSchema = z
  .object({
    question: z.string().trim().max(200).optional(),
    profile: DatasetProfileSchema,
    samples: z.array(z.record(z.string().max(64), Cell)).max(5),
    retry: z
      .object({
        previousPlan: PlanSchema,
        failures: z
          .array(
            z.object({
              stepId: z.string().max(32),
              reason: z.enum([
                "unknown_column",
                "type_mismatch",
                "empty_result",
              ]),
            })
          )
          .max(6),
      })
      .optional(),
  })
  .strict();

export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export const StepResultSchema = z
  .object({
    stepId: z.string().max(32),
    title: z.string().max(80),
    kind: StepSchema.shape.kind,
    agg: StepSchema.shape.agg,
    column: z.string().max(64).nullable(),
    rows: z
      .array(
        z.object({
          label: z.string().max(64),
          value: z.number().finite(),
        })
      )
      .max(60),
    rowsUsed: z.number().int().nonnegative(),
    anomalies: z
      .array(
        z.object({
          label: z.string().max(64),
          value: z.number().finite(),
          expected: z.number().finite(),
          direction: z.enum(["spike", "drop"]),
          score: z.number().finite(),
        })
      )
      .max(3),
  })
  .strict();

export const NarrateRequestSchema = z
  .object({
    question: z.string().trim().max(200).optional(),
    results: z.array(StepResultSchema).min(1).max(6),
  })
  .strict();

export type NarrateRequest = z.infer<typeof NarrateRequestSchema>;

export type Source = "gemini" | "cache" | "fallback";

export interface ResponseMeta {
  source: Source;
  model: string | null;
  latencyMs: number;
  attempts: number;
  promptTokens: number;
  outputTokens: number;
  requestBytes: number;
}

export interface PlanResponse {
  plan: Plan;
  meta: ResponseMeta;
}

export interface NarrateResponse {
  actions: Action[];
  rejected: number;
  meta: ResponseMeta;
}

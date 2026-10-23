/** Strict request and response contracts for /api/plan and /api/narrate. */
import { z } from "zod";
import {
  DatasetProfileSchema,
  PlanSchema,
  StepSchema,
  ActionSchema,
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

export const SourceSchema = z.enum(["gemini", "cache", "fallback"]);
export type Source = z.infer<typeof SourceSchema>;

export const ResponseMetaSchema = z.object({
  source: SourceSchema,
  model: z.string().nullable(),
  latencyMs: z.number().nonnegative(),
  attempts: z.number().int().nonnegative(),
  promptTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  requestBytes: z.number().nonnegative(),
});
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

/** Response bodies are validated again in the browser before use. */
export const PlanResponseSchema = z.object({ plan: PlanSchema, meta: ResponseMetaSchema });
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export const NarrateResponseSchema = z.object({
  actions: z.array(ActionSchema),
  rejected: z.number().int().nonnegative(),
  meta: ResponseMetaSchema,
});
export type NarrateResponse = z.infer<typeof NarrateResponseSchema>;

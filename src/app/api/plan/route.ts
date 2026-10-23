import { buildFallbackPlan } from "@/lib/engine/fallback";
import { type Plan, PlanSchema } from "@/lib/engine/schemas";
import { sanitizePlan, validatePlan } from "@/lib/engine/validate";
import { TtlCache, cacheKey } from "@/lib/server/cache";
import {
  PlanRequestSchema,
  type PlanResponse,
  type Source,
} from "@/lib/server/contracts";
import {
  GeminiUnavailableError,
  ModelOutputError,
  type GeminiResult,
  generateJson,
} from "@/lib/server/gemini";
import { clientIp, jsonError, readJsonBody } from "@/lib/server/http";
import { PLAN_SYSTEM, planPrompt } from "@/lib/server/prompts";
import { checkRateLimit } from "@/lib/server/rate-limit";

const planCache = new TtlCache<{ plan: Plan; model: string | null }>(
  100,
  3_600_000
);

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = clientIp(request);
    const rate = checkRateLimit("plan:" + ip);
    if (!rate.ok) {
      return jsonError("rate_limited", 429, {
        "Retry-After": String(rate.retryAfterSec),
      });
    }

    const readResult = await readJsonBody(request);
    if (!readResult.ok) {
      return jsonError(
        readResult.code,
        readResult.code === "payload_too_large" ? 413 : 400
      );
    }
    const { body, bytes: requestBytes } = readResult;

    const parsed = PlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("invalid_request", 400);
    }
    const input = parsed.data;

    const key = cacheKey({
      v: 1,
      cols: input.profile.columns.map((c) => [c.name, c.kind]),
      q: input.question ?? "",
      retry: input.retry,
    });

    const cached = planCache.get(key);
    if (cached) {
      const cachedResponse: PlanResponse = {
        plan: cached.plan,
        meta: {
          source: "cache",
          model: cached.model,
          latencyMs: 0,
          attempts: 0,
          promptTokens: 0,
          outputTokens: 0,
          requestBytes,
        },
      };
      return Response.json(cachedResponse, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    let finalPlan: Plan | null = null;
    let source: Source = "gemini";
    let modelName: string | null = null;
    let totalLatencyMs = 0;
    let totalAttempts = 0;
    let totalPromptTokens = 0;
    let totalOutputTokens = 0;

    try {
      let call1Result: GeminiResult<Plan> | null = null;
      let call1FailedWithModelOutput = false;

      try {
        call1Result = await generateJson({
          system: PLAN_SYSTEM,
          prompt: planPrompt(input),
          schema: PlanSchema,
        });
        totalLatencyMs += call1Result.latencyMs;
        totalAttempts += call1Result.attempts;
        totalPromptTokens += call1Result.usage.promptTokens;
        totalOutputTokens += call1Result.usage.outputTokens;
        modelName = call1Result.model;
      } catch (err) {
        if (err instanceof ModelOutputError) {
          call1FailedWithModelOutput = true;
          totalAttempts += 1;
        } else {
          throw err;
        }
      }

      if (call1Result) {
        const issues = validatePlan(call1Result.data, input.profile);
        if (issues.length > 0) {
          const repairResult = await generateJson({
            system: PLAN_SYSTEM,
            prompt: planPrompt(input, issues),
            schema: PlanSchema,
          });
          totalLatencyMs += repairResult.latencyMs;
          totalAttempts += repairResult.attempts;
          totalPromptTokens += repairResult.usage.promptTokens;
          totalOutputTokens += repairResult.usage.outputTokens;
          modelName = repairResult.model;
          finalPlan = sanitizePlan(repairResult.data, input.profile);
        } else {
          finalPlan = sanitizePlan(call1Result.data, input.profile);
        }
      } else if (call1FailedWithModelOutput) {
        const repairResult = await generateJson({
          system: PLAN_SYSTEM,
          prompt: planPrompt(input),
          schema: PlanSchema,
        });
        totalLatencyMs += repairResult.latencyMs;
        totalAttempts += repairResult.attempts;
        totalPromptTokens += repairResult.usage.promptTokens;
        totalOutputTokens += repairResult.usage.outputTokens;
        modelName = repairResult.model;
        finalPlan = sanitizePlan(repairResult.data, input.profile);
      }
    } catch (err) {
      if (
        err instanceof GeminiUnavailableError ||
        err instanceof ModelOutputError
      ) {
        finalPlan = null;
      } else {
        throw err;
      }
    }

    if (!finalPlan) {
      source = "fallback";
      modelName = null;
      finalPlan = buildFallbackPlan(input.profile);
      if (!finalPlan) {
        return jsonError("invalid_request", 400);
      }
    }

    if (source === "gemini") {
      planCache.set(key, { plan: finalPlan, model: modelName });
    }

    const responseBody: PlanResponse = {
      plan: finalPlan,
      meta: {
        source,
        model: modelName,
        latencyMs: totalLatencyMs,
        attempts: totalAttempts,
        promptTokens: totalPromptTokens,
        outputTokens: totalOutputTokens,
        requestBytes,
      },
    };

    return Response.json(responseBody, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("plan_route", err instanceof Error ? err.name : "unknown");
    return jsonError("internal_error", 500);
  }
}

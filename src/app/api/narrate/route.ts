import { buildFallbackActions } from "@/lib/engine/fallback";
import { type Action, NarrationSchema } from "@/lib/engine/schemas";
import { verifyActions } from "@/lib/engine/verify";
import { TtlCache, cacheKey } from "@/lib/server/cache";
import {
  NarrateRequestSchema,
  type NarrateResponse,
  type Source,
} from "@/lib/server/contracts";
import {
  GeminiUnavailableError,
  ModelOutputError,
  generateJson,
} from "@/lib/server/gemini";
import { clientIp, jsonError, readJsonBody } from "@/lib/server/http";
import { NARRATE_SYSTEM, narratePrompt } from "@/lib/server/prompts";
import { checkRateLimit } from "@/lib/server/rate-limit";

const narrateCache = new TtlCache<{
  actions: Action[];
  rejected: number;
  model: string | null;
}>(100, 3_600_000);

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = clientIp(request);
    const rate = checkRateLimit("narrate:" + ip);
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

    const parsed = NarrateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("invalid_request", 400);
    }
    const input = parsed.data;

    const key = cacheKey({
      v: 1,
      q: input.question ?? "",
      results: input.results,
    });

    const cached = narrateCache.get(key);
    if (cached) {
      const cachedResponse: NarrateResponse = {
        actions: cached.actions,
        rejected: cached.rejected,
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

    let actions: Action[] = [];
    let rejected = 0;
    let source: Source = "gemini";
    let modelName: string | null = null;
    let latencyMs = 0;
    let attempts = 0;
    let promptTokens = 0;
    let outputTokens = 0;

    try {
      const result = await generateJson({
        system: NARRATE_SYSTEM,
        prompt: narratePrompt(input),
        schema: NarrationSchema,
      });

      modelName = result.model;
      latencyMs = result.latencyMs;
      attempts = result.attempts;
      promptTokens = result.usage.promptTokens;
      outputTokens = result.usage.outputTokens;

      const verified = verifyActions(result.data.actions, input.results);
      actions = verified.valid;
      rejected = verified.rejected;

      if (actions.length < 3) {
        const fallbackActions = buildFallbackActions(input.results);
        const existingTitles = new Set(
          actions.map((a) => a.title.toLowerCase())
        );
        for (const fb of fallbackActions) {
          if (!existingTitles.has(fb.title.toLowerCase())) {
            actions.push(fb);
            existingTitles.add(fb.title.toLowerCase());
            if (actions.length >= 3) break;
          }
        }
      } else if (actions.length > 3) {
        actions = actions.slice(0, 3);
      }
    } catch (err) {
      if (
        err instanceof GeminiUnavailableError ||
        err instanceof ModelOutputError
      ) {
        source = "fallback";
        modelName = null;
        actions = buildFallbackActions(input.results).slice(0, 3);
        rejected = 0;
      } else {
        throw err;
      }
    }

    if (source === "gemini") {
      narrateCache.set(key, { actions, rejected, model: modelName });
    }

    const responseBody: NarrateResponse = {
      actions,
      rejected,
      meta: {
        source,
        model: modelName,
        latencyMs,
        attempts,
        promptTokens,
        outputTokens,
        requestBytes,
      },
    };

    return Response.json(responseBody, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("narrate_route", err instanceof Error ? err.name : "unknown");
    return jsonError("internal_error", 500);
  }
}

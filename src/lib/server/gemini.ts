/** Server-only Gemini client: schema-constrained JSON output, timeouts and retry with backoff. */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export class GeminiUnavailableError extends Error {}
export class ModelOutputError extends Error {}

export interface GeminiUsage {
  promptTokens: number;
  outputTokens: number;
}

export interface GeminiResult<T> {
  data: T;
  usage: GeminiUsage;
  latencyMs: number;
  attempts: number;
  model: string;
}

export const backoff = {
  sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
};

export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<GeminiResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new GeminiUnavailableError("missing_key");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxAttempts = opts.maxAttempts ?? 3;

  const startTime = performance.now();
  const ai = new GoogleGenAI({ apiKey });

  let lastStatus: number | undefined;
  let lastErrorName: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiSchema(opts.schema),
          temperature: 0.2,
          maxOutputTokens: 2048,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });

      const text = response.text ?? "";
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new ModelOutputError("invalid_output");
      }

      const parsed = opts.schema.safeParse(raw);
      if (!parsed.success) {
        throw new ModelOutputError("invalid_output");
      }

      const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        data: parsed.data,
        usage: { promptTokens, outputTokens },
        latencyMs,
        attempts: attempt,
        model,
      };
    } catch (err) {
      if (err instanceof ModelOutputError) {
        throw err;
      }

      const status =
        typeof (err as { status?: unknown })?.status === "number"
          ? (err as { status: number }).status
          : undefined;
      const errName =
        typeof (err as { name?: unknown })?.name === "string"
          ? (err as { name: string }).name
          : "";

      lastStatus = status;
      lastErrorName = errName;

      const isRetryableStatus =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;
      const isTimeout =
        errName === "AbortError" || errName === "TimeoutError";

      if (isRetryableStatus || isTimeout) {
        if (attempt < maxAttempts) {
          const jitter = Math.floor(Math.random() * 200);
          const delay = 400 * 2 ** (attempt - 1) + jitter;
          await backoff.sleep(delay);
          continue;
        }

        if (lastStatus === 429) {
          throw new GeminiUnavailableError("rate_limited");
        }
        if (lastErrorName === "AbortError" || lastErrorName === "TimeoutError") {
          throw new GeminiUnavailableError("timeout");
        }
        throw new GeminiUnavailableError("upstream_error");
      }

      throw new GeminiUnavailableError("upstream_error");
    }
  }

  if (lastStatus === 429) {
    throw new GeminiUnavailableError("rate_limited");
  }
  if (lastErrorName === "AbortError" || lastErrorName === "TimeoutError") {
    throw new GeminiUnavailableError("timeout");
  }
  throw new GeminiUnavailableError("upstream_error");
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  GeminiUnavailableError,
  ModelOutputError,
  backoff,
  generateJson,
  toGeminiSchema,
} from "./gemini";

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
      };
    },
  };
});

const testSchema = z.object({
  name: z.string(),
  count: z.number(),
});

describe("gemini client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(backoff, "sleep").mockResolvedValue();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("throws missing_key without an api key", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      generateJson({ system: "sys", prompt: "prompt", schema: testSchema })
    ).rejects.toThrowError(new GeminiUnavailableError("missing_key"));
  });

  it("parses valid structured output and reports usage", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ name: "sales", count: 42 }),
      usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25 },
    });

    const res = await generateJson({
      system: "sys",
      prompt: "prompt",
      schema: testSchema,
    });

    expect(res.data).toEqual({ name: "sales", count: 42 });
    expect(res.usage).toEqual({ promptTokens: 15, outputTokens: 25 });
    expect(res.attempts).toBe(1);
    expect(res.model).toBe("gemini-3.5-flash-lite");
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("retries on 429 then succeeds", async () => {
    mockGenerateContent
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({
        text: JSON.stringify({ name: "retried", count: 99 }),
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      });

    const res = await generateJson({
      system: "sys",
      prompt: "prompt",
      schema: testSchema,
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(res.attempts).toBe(2);
    expect(res.data.name).toBe("retried");
    expect(backoff.sleep).toHaveBeenCalledTimes(1);
  });

  it("gives up after max attempts with rate_limited", async () => {
    mockGenerateContent
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 });

    await expect(
      generateJson({
        system: "sys",
        prompt: "prompt",
        schema: testSchema,
        maxAttempts: 3,
      })
    ).rejects.toThrowError(new GeminiUnavailableError("rate_limited"));

    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(backoff.sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    mockGenerateContent.mockRejectedValueOnce({ status: 400 });

    await expect(
      generateJson({
        system: "sys",
        prompt: "prompt",
        schema: testSchema,
      })
    ).rejects.toThrowError(new GeminiUnavailableError("upstream_error"));

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(backoff.sleep).not.toHaveBeenCalled();
  });

  it("throws ModelOutputError on schema-invalid output", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ name: "missing-count" }),
    });

    await expect(
      generateJson({
        system: "sys",
        prompt: "prompt",
        schema: testSchema,
      })
    ).rejects.toThrowError(new ModelOutputError("invalid_output"));
  });

  it("toGeminiSchema has no $schema key", () => {
    const s = toGeminiSchema(testSchema);
    expect(s).not.toHaveProperty("$schema");
    expect(s.type).toBe("object");
  });
});

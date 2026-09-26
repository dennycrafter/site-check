import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { analysisModel, getAnthropic } from "./anthropic";
import { SYSTEM_PROMPT, stepPrompt } from "./prompts";
import { PHOTO_ANALYSIS_SCHEMA, parseAnalysisText, type PhotoAnalysis } from "./schema";
import type { StepId } from "./steps";

const MAX_AI_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 30_000;
const BACKOFF_MS = [1_000, 3_000];
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export type AnalyzeResult =
  | { ok: true; analysis: PhotoAnalysis; aiAttempts: number; latencyMs: number; model: string }
  | { ok: false; error: string; aiAttempts: number; latencyMs: number; model: string };

class NonRetryableError extends Error {}

function isRetryable(err: unknown): boolean {
  if (err instanceof NonRetryableError) return false;
  if (err instanceof Anthropic.APIError && typeof err.status === "number") {
    return RETRYABLE_STATUS.has(err.status) || err.status >= 500;
  }
  return true;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\s+/g, " ").slice(0, 300);
  return String(err);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attemptOnce(step: StepId, base64Jpeg: string, model: string): Promise<PhotoAnalysis> {
  const failureRate = Number(process.env.SIMULATE_AI_FAILURE_RATE ?? 0);
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new Error("Simulated AI failure");
  }

  let client: Anthropic;
  try {
    client = getAnthropic();
  } catch (err) {
    throw new NonRetryableError(errorMessage(err));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
              { type: "text", text: stepPrompt(step) },
            ],
          },
        ],
        output_config: {
          format: {
            type: "json_schema",
            schema: PHOTO_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
          },
        },
      },
      { signal: controller.signal },
    );
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      throw new Error(`stop_reason ${response.stop_reason}`);
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text block in response");
    return parseAnalysisText(textBlock.text);
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`Timed out after ${ATTEMPT_TIMEOUT_MS / 1000}s`);
    if (err instanceof Anthropic.APIError && err.status && !isRetryable(err)) {
      throw new NonRetryableError(errorMessage(err));
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads one photo into the fixed analysis schema. Never throws: after all
 * attempts fail it returns ok=false so the caller can degrade to check_failed.
 */
export async function analyzePhoto(params: {
  homeId: string;
  step: StepId;
  base64Jpeg: string;
}): Promise<AnalyzeResult> {
  const { homeId, step, base64Jpeg } = params;
  const model = analysisModel();
  const started = Date.now();
  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    const attemptStart = Date.now();
    try {
      const analysis = await attemptOnce(step, base64Jpeg, model);
      console.log(
        `[analyze] home=${homeId} step=${step} attempt=${attempt} ok=true ms=${Date.now() - attemptStart} err=`,
      );
      return { ok: true, analysis, aiAttempts: attempt, latencyMs: Date.now() - started, model };
    } catch (err) {
      lastError = errorMessage(err);
      console.log(
        `[analyze] home=${homeId} step=${step} attempt=${attempt} ok=false ms=${Date.now() - attemptStart} err=${lastError}`,
      );
      if (!isRetryable(err)) {
        return { ok: false, error: lastError, aiAttempts: attempt, latencyMs: Date.now() - started, model };
      }
      if (attempt < MAX_AI_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1]);
    }
  }

  return {
    ok: false,
    error: lastError,
    aiAttempts: MAX_AI_ATTEMPTS,
    latencyMs: Date.now() - started,
    model,
  };
}

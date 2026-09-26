import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./anthropic";

const MAX_AI_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 30_000;
const BACKOFF_MS = [1_000, 3_000];
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export class NonRetryableError extends Error {}

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

export type RetryResult<T> =
  | { ok: true; value: T; aiAttempts: number; latencyMs: number }
  | { ok: false; error: string; aiAttempts: number; latencyMs: number };

/**
 * Runs one AI call with a 30 s timeout per attempt, 3 attempts, 1 s then 3 s
 * backoff and SIMULATE_AI_FAILURE_RATE injection. Never throws.
 */
export async function withAiRetries<T>(
  call: (client: Anthropic, signal: AbortSignal) => Promise<T>,
  log: (attempt: number, ok: boolean, ms: number, err: string) => void,
): Promise<RetryResult<T>> {
  const started = Date.now();
  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    const attemptStart = Date.now();
    try {
      const value = await attemptOnce(call);
      log(attempt, true, Date.now() - attemptStart, "");
      return { ok: true, value, aiAttempts: attempt, latencyMs: Date.now() - started };
    } catch (err) {
      lastError = errorMessage(err);
      log(attempt, false, Date.now() - attemptStart, lastError);
      if (!isRetryable(err)) {
        return { ok: false, error: lastError, aiAttempts: attempt, latencyMs: Date.now() - started };
      }
      if (attempt < MAX_AI_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1]);
    }
  }
  return { ok: false, error: lastError, aiAttempts: MAX_AI_ATTEMPTS, latencyMs: Date.now() - started };
}

async function attemptOnce<T>(call: (client: Anthropic, signal: AbortSignal) => Promise<T>): Promise<T> {
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
    return await call(client, controller.signal);
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

/** Returns the text of a structured-output response, or throws a retryable error. */
export function responseText(response: Anthropic.Message): string {
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new Error(`stop_reason ${response.stop_reason}`);
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text block in response");
  return textBlock.text;
}

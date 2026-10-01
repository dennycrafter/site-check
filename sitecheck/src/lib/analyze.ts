import "server-only";
import { withAiRetries, responseText } from "./aiRetry";
import { AI_EFFORT, analysisModel } from "./anthropic";
import { SYSTEM_PROMPT, stepPrompt } from "./prompts";
import { PHOTO_ANALYSIS_SCHEMA, parseAnalysisText, type PhotoAnalysis } from "./schema";
import type { Step } from "./steps";

export type AnalyzeResult =
  | { ok: true; analysis: PhotoAnalysis; aiAttempts: number; latencyMs: number; model: string }
  | { ok: false; error: string; aiAttempts: number; latencyMs: number; model: string };

/**
 * Reads one photo into the fixed analysis schema. Never throws: after all
 * attempts fail it returns ok=false so the caller can degrade to check_failed.
 */
export async function analyzePhoto(params: {
  homeId: string;
  step: Step;
  base64Jpeg: string;
  /** Simulated AI failure rate for this call. Defaults to SIMULATE_AI_FAILURE_RATE. */
  failureRate?: number;
}): Promise<AnalyzeResult> {
  const { homeId, step, base64Jpeg, failureRate } = params;
  const model = analysisModel();

  const result = await withAiRetries(
    async (client, signal) => {
      const response = await client.messages.create(
        {
          model,
          max_tokens: 4096,
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
            effort: AI_EFFORT,
            format: {
              type: "json_schema",
              schema: PHOTO_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
            },
          },
        },
        { signal },
      );
      return parseAnalysisText(responseText(response));
    },
    (attempt, ok, ms, err) =>
      console.log(`[analyze] home=${homeId} step=${step.id} attempt=${attempt} ok=${ok} ms=${ms} err=${err}`),
    failureRate,
  );

  if (result.ok) {
    return { ok: true, analysis: result.value, aiAttempts: result.aiAttempts, latencyMs: result.latencyMs, model };
  }
  return { ok: false, error: result.error, aiAttempts: result.aiAttempts, latencyMs: result.latencyMs, model };
}

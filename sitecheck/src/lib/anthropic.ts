import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY must be set");
  // maxRetries 0: lib/analyze.ts owns all retry logic, otherwise retries multiply.
  client = new Anthropic({ apiKey, maxRetries: 0 });
  return client;
}

export function analysisModel(): string {
  return process.env.ANALYSIS_MODEL || "claude-sonnet-5";
}

/**
 * The model thinks before answering and those tokens count toward max_tokens.
 * Default effort used 1.5k-2k thinking tokens and 20 s+ per photo; medium gave
 * the same readings on our test photos in under 10 s.
 */
export const AI_EFFORT = "medium" as const;

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

import "server-only";
import { z } from "zod";
import { withAiRetries, responseText } from "./aiRetry";
import { AI_EFFORT, analysisModel } from "./anthropic";
import { latestFinishedByStep } from "./plan";
import { SPACE_STEPS, stepTitle } from "./steps";
import { getSupabase, PHOTO_BUCKET } from "./supabase";
import type { ExtraStep, HomeRow, PhotoRow, SiteCheckResult, SiteCheckStatus } from "./types";

const MAX_EXTRA_STEPS = 2;

export const SITE_CHECK_SYSTEM_PROMPT = `You look at a set of outdoor photos of the walls around a home's electric meter. A home battery, about 2.5 ft wide, 2 ft deep and 3 ft tall, will stand on the ground against a wall near the meter, connected by a cable that runs along the wall.

Your only job: decide whether these photos, taken together, show enough of the area for a reviewer to decide if the battery fits. You are NOT deciding whether it fits.

Rules:
1. If the photos already clearly show at least one open spot against a wall near the meter, with the ground in front of it visible, set covered to true and leave missing_views empty. One clear spot is enough.
2. Otherwise, list at most 2 areas that are not shown and might hold the battery. Examples: a wall that runs out of the frame, the area behind a closed gate, around a corner nobody photographed, or the wall behind a large object like an AC unit.
3. Never ask for an area that is already clearly shown, even if it looks unsuitable.
4. Each instruction is one short, friendly sentence for the homeowner. Max 15 words. No jargon. Example: "Take a photo of the wall past the AC unit, from 10 steps back."
5. summary is one plain sentence describing what the photos cover.
6. confidence is 0 to 100.`;

export const SITE_CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["covered", "missing_views", "summary", "confidence"],
  properties: {
    covered: { type: "boolean" },
    missing_views: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["instruction", "reason"],
        properties: {
          instruction: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
    confidence: { type: "integer" },
  },
} as const;

const SiteCheckZod = z.object({
  covered: z.boolean(),
  missing_views: z.array(z.object({ instruction: z.string(), reason: z.string() })),
  summary: z.string(),
  confidence: z.number(),
});

export function parseSiteCheckText(text: string): SiteCheckResult {
  const parsed = SiteCheckZod.parse(JSON.parse(text));
  return { ...parsed, confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence))) };
}

/** covered=false with no usable instruction is treated as covered. */
export function extraStepsFrom(result: SiteCheckResult): ExtraStep[] {
  if (result.covered) return [];
  return result.missing_views
    .map((v) => ({ instruction: v.instruction.trim(), reason: v.reason.trim() }))
    .filter((v) => v.instruction.length > 0)
    .slice(0, MAX_EXTRA_STEPS)
    .map((v, i) => ({ id: `extra_${i + 1}`, ...v }));
}

export type SiteCheckOutcome = {
  status: Exclude<SiteCheckStatus, "not_run">;
  result: SiteCheckResult | null;
  extraSteps: ExtraStep[];
};

/** Looks at all wall photos together and asks for up to 2 missing views. Never throws on AI failure. */
export async function runSiteCheck(home: HomeRow, photos: PhotoRow[]): Promise<SiteCheckOutcome> {
  const finished = latestFinishedByStep(photos);
  const inputs = SPACE_STEPS.flatMap((step) => {
    const photo = finished.get(step);
    return photo && (photo.status === "accepted" || photo.status === "accepted_after_max_attempts") ? [photo] : [];
  });
  const failed: SiteCheckOutcome = { status: "failed", result: null, extraSteps: [] };
  if (inputs.length === 0) {
    console.log(`[sitecheck] home=${home.id} photos=0 attempt=0 ok=false ms=0 err=No usable wall photos`);
    return failed;
  }

  const supabase = getSupabase();
  let images: { step: string; base64: string }[];
  try {
    images = await Promise.all(
      inputs.map(async (photo) => {
        const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(photo.storage_path);
        if (error || !data) throw new Error(`Download failed for ${photo.storage_path}: ${error?.message}`);
        return { step: photo.step, base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[sitecheck] home=${home.id} photos=${inputs.length} attempt=0 ok=false ms=0 err=${msg}`);
    return failed;
  }

  const content = [
    ...images.flatMap((img, i) => [
      { type: "text" as const, text: `Photo ${i + 1}: ${stepTitle(img.step)}` },
      {
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/jpeg" as const, data: img.base64 },
      },
    ]),
    { type: "text" as const, text: "Decide whether these photos, taken together, cover the area. Fill the schema." },
  ];

  const model = analysisModel();
  const outcome = await withAiRetries(
    async (client, signal) => {
      const response = await client.messages.create(
        {
          model,
          max_tokens: 2048,
          system: SITE_CHECK_SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
          output_config: {
            effort: AI_EFFORT,
            format: { type: "json_schema", schema: SITE_CHECK_SCHEMA as unknown as Record<string, unknown> },
          },
        },
        { signal },
      );
      return parseSiteCheckText(responseText(response));
    },
    (attempt, ok, ms, err) =>
      console.log(
        `[sitecheck] home=${home.id} photos=${images.length} attempt=${attempt} ok=${ok} ms=${ms} err=${err}`,
      ),
  );

  if (!outcome.ok) return failed;
  return { status: "done", result: outcome.value, extraSteps: extraStepsFrom(outcome.value) };
}

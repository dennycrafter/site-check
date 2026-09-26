import { NextResponse } from "next/server";
import { HomeIdZod, jsonError, serverError } from "@/lib/api";
import { analyzePhoto } from "@/lib/analyze";
import { decidePhoto } from "@/lib/decide";
import { loadHome, recomputeHome } from "@/lib/homes";
import { latestFinishedByStep } from "@/lib/plan";
import { isStepId } from "@/lib/steps";
import { getSupabase, PHOTO_BUCKET } from "@/lib/supabase";
import type { PhotoRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const CONCURRENCY = 4;

type StepOutcome = { step: string; ok: boolean; status: PhotoRow["status"]; error?: string };

async function recheckPhoto(photo: PhotoRow): Promise<StepOutcome> {
  if (!isStepId(photo.step)) throw new Error(`Unknown step ${photo.step}`);
  const supabase = getSupabase();
  const { data: blob, error: downloadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .download(photo.storage_path);
  if (downloadError || !blob) throw new Error(`Download failed: ${downloadError?.message}`);
  const base64Jpeg = Buffer.from(await blob.arrayBuffer()).toString("base64");

  const result = await analyzePhoto({ homeId: photo.home_id, step: photo.step, base64Jpeg });
  if (!result.ok) {
    // Keep the previous analysis and status; the surveyor still has what we had.
    return { step: photo.step, ok: false, status: photo.status, error: result.error };
  }
  // The homeowner has left, so a photo that no longer passes goes to a human.
  const status = decidePhoto(photo.step, result.analysis).accept
    ? "accepted"
    : "accepted_after_max_attempts";
  const { error } = await supabase
    .from("photos")
    .update({
      analysis: result.analysis,
      status,
      error: null,
      model: result.model,
      latency_ms: result.latencyMs,
      ai_attempts: result.aiAttempts,
    })
    .eq("id", photo.id);
  if (error) throw new Error(`Save failed: ${error.message}`);
  return { step: photo.step, ok: true, status };
}

async function runPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      [results[index]] = await Promise.allSettled([fn(items[index])]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function POST(_request: Request, ctx: RouteContext<"/api/homes/[id]/recheck">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  try {
    const loaded = await loadHome(id);
    if (!loaded) return jsonError(404, "Home not found");
    const targets = [...latestFinishedByStep(loaded.photos).values()];
    const settled = await runPool(targets, CONCURRENCY, recheckPhoto);
    const steps = settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : {
            step: targets[i].step,
            ok: false,
            status: targets[i].status,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          },
    );
    const { home } = await recomputeHome(id);
    return NextResponse.json({
      verdict: home.verdict,
      batteryCount: home.battery_count,
      reasons: home.reasons,
      steps,
    });
  } catch (err) {
    return serverError("homes.recheck", err);
  }
}

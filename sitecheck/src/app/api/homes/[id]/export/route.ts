import { NextResponse } from "next/server";
import { HomeIdZod, jsonError, serverError } from "@/lib/api";
import { correctPhotosForExport } from "@/lib/exportCorrections";
import { loadCorrections, loadHome } from "@/lib/homes";
import { latestFinishedByStep, planSteps } from "@/lib/plan";
import { baseSlotFor } from "@/lib/steps";
import { signedUrls } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const EXPORT_URL_SECONDS = 86_400;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/homes/[id]/export">,
) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  try {
    const loaded = await loadHome(id);
    if (!loaded) return jsonError(404, "Home not found");
    const { home, photos: aiPhotos } = loaded;

    const corrected = correctPhotosForExport(aiPhotos, await loadCorrections([home.id]));
    const photos = corrected.map((c) => c.photo);
    const byId = new Map(corrected.map((c) => [c.photo.id, c]));

    const finished = latestFinishedByStep(photos);
    const order = planSteps(home, photos) as string[];
    const steps = [
      ...order.filter((s) => finished.has(s)),
      ...[...finished.keys()].filter((s) => !order.includes(s)),
    ];
    const urls = await signedUrls(
      steps.map((s) => finished.get(s)!.storage_path),
      EXPORT_URL_SECONDS,
    );

    const grouped: Record<string, unknown[]> = {};
    for (const step of steps) {
      const photo = finished.get(step)!;
      const { aiAnalysis, correctedFields } = byId.get(photo.id)!;
      const slot = baseSlotFor(step);
      (grouped[slot] ??= []).push({
        step,
        url: urls[photo.storage_path] ?? null,
        attempt: photo.attempt,
        status: photo.status,
        capturedAt: photo.created_at,
        analysis: photo.analysis,
        aiAnalysis,
        correctedFields,
      });
    }

    return NextResponse.json({
      externalRef: home.external_ref,
      homeId: home.id,
      customer: { name: home.customer_name, email: home.customer_email },
      address: home.address,
      property: home.property ?? null,
      answers: {
        inAustin: home.in_austin,
        hasSolar: home.has_solar,
        panelSameWallAnswer: home.panel_same_wall_answer,
      },
      status: home.status,
      submittedAt: home.submitted_at,
      photos: grouped,
      siteCheck: { status: home.site_check_status, result: home.site_check },
      preliminary: {
        verdict: home.verdict,
        batteryCount: home.battery_count,
        reasons: home.reasons,
      },
    });
  } catch (err) {
    return serverError("homes.export", err);
  }
}

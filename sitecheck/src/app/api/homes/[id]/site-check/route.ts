import { NextResponse } from "next/server";
import { HomeIdZod, jsonError, serverError } from "@/lib/api";
import { loadHome, recomputeHome } from "@/lib/homes";
import { nextStep } from "@/lib/plan";
import { runSiteCheck } from "@/lib/siteCheck";
import { getSupabase } from "@/lib/supabase";
import type { HomeRow, PhotoRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function respond(home: HomeRow, photos: PhotoRow[]) {
  return NextResponse.json({
    status: home.site_check_status,
    covered: home.site_check_status === "done" && home.extra_steps.length === 0,
    extraSteps: home.extra_steps.map((e) => ({ id: e.id, instruction: e.instruction })),
    nextStep: nextStep(home, photos),
  });
}

export async function POST(_request: Request, ctx: RouteContext<"/api/homes/[id]/site-check">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  try {
    const loaded = await loadHome(id);
    if (!loaded) return jsonError(404, "Home not found");
    const { home, photos } = loaded;
    if (home.site_check_status !== "not_run") return respond(home, photos);
    const pending = nextStep(home, photos);
    if (pending !== "site_check") {
      return jsonError(409, "Finish the photo steps first.", { nextStep: pending });
    }

    const outcome = await runSiteCheck(home, photos);
    // Only the first finished run is saved; a concurrent duplicate returns what was stored.
    const { data, error } = await getSupabase()
      .from("homes")
      .update({
        site_check_status: outcome.status,
        site_check: outcome.result,
        extra_steps: outcome.extraSteps,
      })
      .eq("id", id)
      .eq("site_check_status", "not_run")
      .select("id");
    if (error) throw new Error(`Save site check failed: ${error.message}`);
    if (!data || data.length === 0) {
      const fresh = await loadHome(id);
      if (!fresh) return jsonError(404, "Home not found");
      return respond(fresh.home, fresh.photos);
    }
    const fresh = await recomputeHome(id);
    return respond(fresh.home, fresh.photos);
  } catch (err) {
    return serverError("homes.site-check", err);
  }
}

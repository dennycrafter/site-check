import { NextResponse } from "next/server";
import { z } from "zod";
import { HomeIdZod, jsonError, readJson, serverError } from "@/lib/api";
import { MESSAGES } from "@/lib/decide";
import { loadHome, recomputeHome } from "@/lib/homes";
import { latestPhotoByStep, nextStep, planSteps } from "@/lib/plan";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const KeepBodyZod = z.object({ homeId: HomeIdZod, step: z.string().min(1).max(40) });

/** The homeowner keeps a photo the check asked them to retake; it goes to review as is. */
export async function POST(request: Request) {
  const body = KeepBodyZod.safeParse(await readJson(request));
  if (!body.success) return jsonError(400, "Invalid request.");
  const { homeId, step } = body.data;

  try {
    const loaded = await loadHome(homeId);
    if (!loaded) return jsonError(404, "Home not found");
    const { home, photos } = loaded;
    if (home.status === "submitted") return jsonError(409, "This home was already submitted.");
    const latest = latestPhotoByStep(photos).get(step);
    if (!planSteps(home, photos).includes(step) || latest?.status !== "retake") {
      return jsonError(409, "There is no photo to keep for this step.", { nextStep: nextStep(home, photos) });
    }

    const { error } = await getSupabase()
      .from("photos")
      .update({ status: "accepted_after_max_attempts" })
      .eq("id", latest.id)
      .eq("status", "retake");
    if (error) throw new Error(`Keep photo failed: ${error.message}`);

    const fresh = await recomputeHome(homeId);
    return NextResponse.json({
      status: "accepted_after_max_attempts",
      message: MESSAGES.maxAttempts,
      attempt: latest.attempt,
      nextStep: nextStep(fresh.home, fresh.photos),
    });
  } catch (err) {
    return serverError("photos/keep", err);
  }
}

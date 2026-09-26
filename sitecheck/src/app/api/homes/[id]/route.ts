import { NextResponse } from "next/server";
import { z } from "zod";
import { HomeIdZod, jsonError, readJson, serverError } from "@/lib/api";
import { buildStepViews, loadHome, publicHome, recomputeHome } from "@/lib/homes";
import { nextStep } from "@/lib/plan";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/homes/[id]">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  try {
    const loaded = await loadHome(id);
    if (!loaded) return jsonError(404, "Home not found");
    const { home, photos } = loaded;
    return NextResponse.json({
      home: publicHome(home),
      steps: await buildStepViews(home, photos),
      nextStep: nextStep(home, photos),
    });
  } catch (err) {
    return serverError("homes.get", err);
  }
}

const PatchZod = z.object({ panelSameWallAnswer: z.enum(["yes", "no", "not_sure"]) });

export async function PATCH(request: Request, ctx: RouteContext<"/api/homes/[id]">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  const body = PatchZod.safeParse(await readJson(request));
  if (!body.success) return jsonError(400, "Answer must be yes, no or not_sure.");
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .update({ panel_same_wall_answer: body.data.panelSameWallAnswer })
      .eq("id", id)
      .eq("status", "in_progress")
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return jsonError(404, "Home not found or already submitted");
    const { home, photos } = await recomputeHome(id);
    return NextResponse.json({ nextStep: nextStep(home, photos) });
  } catch (err) {
    return serverError("homes.patch", err);
  }
}

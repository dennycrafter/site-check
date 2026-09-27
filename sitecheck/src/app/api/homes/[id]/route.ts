import { NextResponse } from "next/server";
import { z } from "zod";
import { HomeIdZod, jsonError, readJson, serverError } from "@/lib/api";
import { buildStepViews, loadHome, publicHome, recomputeHome } from "@/lib/homes";
import { nextStep } from "@/lib/plan";
import { PropertyZod } from "@/lib/property";
import { getSupabase, listHomeFiles, removeFiles } from "@/lib/supabase";

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

/** Removes the home's photo files first, so a failed cleanup leaves the row in place to retry. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/homes/[id]">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  try {
    const supabase = getSupabase();
    const [homeRes, photosRes] = await Promise.all([
      supabase.from("homes").select("id").eq("id", id).maybeSingle(),
      supabase.from("photos").select("storage_path").eq("home_id", id),
    ]);
    if (homeRes.error) throw homeRes.error;
    if (photosRes.error) throw photosRes.error;
    if (!homeRes.data) return jsonError(404, "Home not found");
    const listed = await listHomeFiles(id);
    const recorded = (photosRes.data ?? []).map((p) => p.storage_path as string).filter(Boolean);
    await removeFiles([...new Set([...listed, ...recorded])]);
    const { error } = await supabase.from("homes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return serverError("homes.delete", err);
  }
}

const AnswerZod = z.object({ panelSameWallAnswer: z.enum(["yes", "no", "not_sure"]) });
const PropertyPatchZod = z.object({ property: PropertyZod });

/** Accepts either the question 5 answer or the map answers. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/homes/[id]">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  const json = await readJson(request);
  const property = PropertyPatchZod.safeParse(json);
  if (property.success && !(json && typeof json === "object" && "panelSameWallAnswer" in json)) {
    return patchProperty(id, property.data.property);
  }
  const body = AnswerZod.safeParse(json);
  if (!body.success) {
    const isMap = json && typeof json === "object" && "property" in json;
    return jsonError(400, isMap ? "Map answers are not valid." : "Answer must be yes, no or not_sure.");
  }
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

async function patchProperty(id: string, property: z.infer<typeof PropertyZod>) {
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .update({ property })
      .eq("id", id)
      .eq("status", "in_progress")
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return jsonError(404, "Home not found or already submitted");
    return NextResponse.json({ saved: true });
  } catch (err) {
    return serverError("homes.patch.property", err);
  }
}

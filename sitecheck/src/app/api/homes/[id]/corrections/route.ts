import { NextResponse } from "next/server";
import { HomeIdZod, jsonError, readJson, serverError } from "@/lib/api";
import { CorrectionBodyZod, correctionValueZod, editableFields } from "@/lib/corrections";
import { isMissingTable, recomputeHome } from "@/lib/homes";
import type { AnalysisField } from "@/lib/schema";
import { getSupabase } from "@/lib/supabase";
import type { PhotoRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Saves a surveyor correction of one AI reading, reruns the rules and returns the new verdict. */
export async function POST(request: Request, ctx: RouteContext<"/api/homes/[id]/corrections">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  const body = CorrectionBodyZod.safeParse(await readJson(request));
  if (!body.success) return jsonError(400, "Send photoId, field and value. The field must be an AI reading.");
  const { photoId } = body.data;
  const field = body.data.field as AnalysisField;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("photos")
      .select("id, step, analysis")
      .eq("id", photoId)
      .eq("home_id", id)
      .maybeSingle();
    if (error) throw error;
    const photo = data as Pick<PhotoRow, "id" | "step" | "analysis"> | null;
    if (!photo) return jsonError(404, "Photo not found");
    if (!photo.analysis) return jsonError(409, "This photo has no AI reading to correct.");
    if (!editableFields(photo.step).includes(field)) {
      return jsonError(400, `${field} is not an editable reading for this photo.`);
    }
    const value = correctionValueZod(field).safeParse(body.data.value);
    if (!value.success) return jsonError(400, `That value is not valid for ${field}.`);

    const insert = await supabase.from("corrections").insert({
      home_id: id,
      photo_id: photo.id,
      step: photo.step,
      field,
      ai_value: photo.analysis[field] ?? null,
      corrected_value: value.data,
    });
    if (isMissingTable(insert.error)) {
      return jsonError(503, "Corrections are not set up yet. Run supabase/migration-v5.sql in Supabase.");
    }
    if (insert.error) throw insert.error;

    const { home } = await recomputeHome(id);
    console.log(
      `[corrections] home=${id} photo=${photo.id} step=${photo.step} field=${field} ai=${JSON.stringify(photo.analysis[field])} value=${JSON.stringify(value.data)} verdict=${home.verdict}`,
    );
    return NextResponse.json({ verdict: home.verdict, batteryCount: home.battery_count, reasons: home.reasons });
  } catch (err) {
    return serverError("homes.corrections", err);
  }
}
